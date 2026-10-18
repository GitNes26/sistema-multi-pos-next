import { prisma } from "@/lib/db"
import { EXPENSE_CATEGORY_LABELS } from "@/lib/expenses/shared"

// «¿Cómo me fue?»: ingresos, costo de lo vendido, gastos y ganancia o pérdida.
// - Costo de lo vendido = costo congelado en cada partida al cobrar (unitCost).
// - Los gastos de «Mercancía e insumos» NO se restan otra vez: esa mercancía ya
//   está en el costo de lo vendido. Se muestran aparte para no duplicar.

const n = (v: unknown) => (v == null ? 0 : Number(v))
const round2 = (v: number) => Math.round(v * 100) / 100

export interface ProfitTotals {
  sales: number
  refunds: number
  netSales: number
  costOfGoods: number
  grossProfit: number
  operatingExpenses: number
  merchandiseExpenses: number
  netProfit: number
  tickets: number
}

export interface ProfitProductRow {
  name: string
  revenue: number
  cost: number
  profit: number
  marginPct: number
  units: number
  missingCost: boolean
}

export interface ProfitSummary {
  from: string
  to: string
  current: ProfitTotals
  previous: ProfitTotals
  previousFrom: string
  previousTo: string
  expensesByCategory: { category: string; label: string; amount: number }[]
  topProducts: ProfitProductRow[]
  worstProducts: ProfitProductRow[]
  /** Partidas vendidas sin costo registrado: la ganancia puede estar sobrestimada. */
  itemsWithoutCost: number
  itemsWithoutCostProducts: string[]
  soldBelowCost: { name: string; price: number; cost: number }[]
  expenseCount: number
}

function ymd(d: Date) {
  const p = (x: number) => String(x).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function range(from: string, to: string) {
  return { gte: new Date(`${from}T00:00:00`), lte: new Date(`${to}T23:59:59.999`) }
}

async function totalsFor(organizationId: string, from: string, to: string, locationId?: string) {
  const r = range(from, to)
  const saleWhere = { organizationId, status: "completed" as const, createdAt: r, ...(locationId ? { locationId } : {}) }
  const [agg, refunds, items, expenses] = await Promise.all([
    prisma.sale.aggregate({ where: saleWhere, _sum: { total: true }, _count: true }),
    prisma.saleReturn.aggregate({
      where: { organizationId, status: "completed", returnType: "refund", createdAt: r, ...(locationId ? { locationId } : {}) },
      _sum: { total: true },
    }),
    prisma.saleItem.findMany({
      where: { sale: saleWhere },
      select: { productId: true, productName: true, quantity: true, unitPrice: true, unitCost: true, lineTotal: true, totalPrice: true },
    }),
    prisma.expense.findMany({
      where: {
        organizationId,
        isActive: true,
        expenseDate: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T23:59:59.999Z`) },
        ...(locationId ? { locationId } : {}),
      },
      select: { category: true, amount: true },
    }),
  ])
  const sales = n(agg._sum.total)
  const refundTotal = n(refunds._sum.total)
  let cost = 0
  for (const i of items) cost += n(i.unitCost) * n(i.quantity)
  let operating = 0
  let merchandise = 0
  const byCategory = new Map<string, number>()
  for (const e of expenses) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + n(e.amount))
    if (e.category === "merchandise") merchandise += n(e.amount)
    else operating += n(e.amount)
  }
  const netSales = sales - refundTotal
  const gross = netSales - cost
  const totals: ProfitTotals = {
    sales: round2(sales),
    refunds: round2(refundTotal),
    netSales: round2(netSales),
    costOfGoods: round2(cost),
    grossProfit: round2(gross),
    operatingExpenses: round2(operating),
    merchandiseExpenses: round2(merchandise),
    netProfit: round2(gross - operating),
    tickets: agg._count,
  }
  return { totals, items, byCategory, expenseCount: expenses.length }
}

export async function getProfitSummary(organizationId: string, from: string, to: string, locationId?: string): Promise<ProfitSummary> {
  // Periodo anterior de la misma duración, inmediatamente antes.
  const start = new Date(`${from}T00:00:00`)
  const end = new Date(`${to}T00:00:00`)
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1)
  const prevTo = new Date(start.getTime() - 86_400_000)
  const prevFrom = new Date(prevTo.getTime() - (days - 1) * 86_400_000)
  const previousFrom = ymd(prevFrom)
  const previousTo = ymd(prevTo)

  const [cur, prev] = await Promise.all([
    totalsFor(organizationId, from, to, locationId),
    totalsFor(organizationId, previousFrom, previousTo, locationId),
  ])

  const products = new Map<string, ProfitProductRow>()
  const missing = new Set<string>()
  let missingCount = 0
  const below = new Map<string, { name: string; price: number; cost: number }>()
  for (const i of cur.items) {
    const key = i.productId ?? i.productName
    const revenue = n(i.lineTotal ?? i.totalPrice)
    const unitCost = n(i.unitCost)
    const cost = unitCost * n(i.quantity)
    const row = products.get(key) ?? { name: i.productName, revenue: 0, cost: 0, profit: 0, marginPct: 0, units: 0, missingCost: false }
    row.revenue += revenue
    row.cost += cost
    row.units += n(i.quantity)
    if (unitCost <= 0) {
      row.missingCost = true
      missingCount += 1
      missing.add(i.productName)
    } else if (n(i.unitPrice) > 0 && n(i.unitPrice) < unitCost) {
      below.set(key, { name: i.productName, price: round2(n(i.unitPrice)), cost: round2(unitCost) })
    }
    products.set(key, row)
  }
  const rows = [...products.values()].map((p) => ({
    ...p,
    revenue: round2(p.revenue),
    cost: round2(p.cost),
    profit: round2(p.revenue - p.cost),
    marginPct: p.revenue > 0 ? Math.round(((p.revenue - p.cost) / p.revenue) * 1000) / 10 : 0,
    units: Math.round(p.units * 1000) / 1000,
  }))
  const known = rows.filter((p) => !p.missingCost)

  return {
    from,
    to,
    current: cur.totals,
    previous: prev.totals,
    previousFrom,
    previousTo,
    expensesByCategory: [...cur.byCategory.entries()]
      .map(([category, amount]) => ({ category, label: EXPENSE_CATEGORY_LABELS[category] ?? category, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount),
    topProducts: [...known].sort((a, b) => b.profit - a.profit).slice(0, 5),
    worstProducts: [...known].sort((a, b) => a.profit - b.profit).slice(0, 5),
    itemsWithoutCost: missingCount,
    itemsWithoutCostProducts: [...missing].slice(0, 8),
    soldBelowCost: [...below.values()].slice(0, 8),
    expenseCount: cur.expenseCount,
  }
}
