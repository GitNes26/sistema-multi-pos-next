import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"
import { isExpenseCategory } from "./shared"

// Dominio de gastos. Todo se aísla por organización; un gasto pagado de la
// caja queda ligado a la sesión abierta y reduce el efectivo esperado del corte.

export interface ExpenseInput {
  category?: unknown
  description?: unknown
  amount?: unknown
  expenseDate?: unknown
  paidFrom?: unknown
  locationId?: unknown
  supplierName?: unknown
  receiptUrl?: unknown
  notes?: unknown
}

export interface ExpenseCtx {
  userId: string
  employeeId?: string | null
  /** Retiro desde el POS: la caja abierta exacta de la que sale el efectivo. */
  cashSessionId?: string | null
}

const num = (v: Prisma.Decimal | number | null | undefined) => (v == null ? 0 : Number(v))

/** «YYYY-MM-DD» → fecha al mediodía UTC (no cambia de día en México). */
export function parseExpenseDate(value: unknown): Date {
  const raw = typeof value === "string" ? value.slice(0, 10) : ""
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new CrudError("Elige la fecha del gasto", 400, "expenseDate")
  const date = new Date(`${raw}T12:00:00.000Z`)
  if (Number.isNaN(date.getTime())) throw new CrudError("Fecha inválida", 400, "expenseDate")
  return date
}

export function todayYmd(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

async function resolveLocation(organizationId: string, locationId: unknown) {
  if (!locationId) return null
  const location = await prisma.location.findFirst({ where: { id: String(locationId), organizationId }, select: { id: true } })
  if (!location) throw new CrudError("La sucursal no pertenece a la empresa activa", 400, "locationId")
  return location.id
}

/** Caja abierta de la sucursal (o la única abierta de la empresa si no se indica sucursal). */
async function openCashSessionFor(organizationId: string, locationId: string | null) {
  const sessions = await prisma.cashSession.findMany({
    where: { organizationId, status: "open", ...(locationId ? { locationId } : {}) },
    select: { id: true, locationId: true },
    take: 2,
  })
  if (sessions.length === 0) {
    throw new CrudError("No hay una caja abierta para sacar el dinero. Abre la caja o elige «Fuera de la caja».", 409, "paidFrom")
  }
  if (sessions.length > 1) throw new CrudError("Hay varias cajas abiertas: elige la sucursal del gasto.", 400, "locationId")
  return sessions[0]
}

export function serializeExpense(e: {
  id: string
  category: string
  description: string
  amount: Prisma.Decimal
  expenseDate: Date
  paidFrom: "cash_register" | "other"
  locationId: string | null
  location?: { name: string } | null
  supplierName: string | null
  receiptUrl: string | null
  notes: string | null
  isActive: boolean
}) {
  const ymd = e.expenseDate.toISOString().slice(0, 10)
  const [y, m, d] = ymd.split("-")
  return {
    id: e.id,
    category: e.category,
    description: e.description,
    amount: num(e.amount),
    expenseDate: ymd,
    dateLabel: `${d}/${m}/${y}`,
    paidFrom: e.paidFrom,
    locationId: e.locationId,
    locationName: e.location?.name ?? null,
    supplierName: e.supplierName,
    receiptUrl: e.receiptUrl,
    notes: e.notes,
    isActive: e.isActive,
  }
}

function clean(value: unknown, max: number) {
  const text = typeof value === "string" ? value.trim() : ""
  return text ? text.slice(0, max) : null
}

export async function createExpense(organizationId: string, input: ExpenseInput, ctx: ExpenseCtx) {
  const description = clean(input.description, 190)
  if (!description) throw new CrudError("Escribe en qué se gastó", 400, "description")
  const amount = Math.round(Number(input.amount) * 100) / 100
  if (!Number.isFinite(amount) || amount <= 0) throw new CrudError("El monto debe ser mayor que cero", 400, "amount")
  const category = input.category ? String(input.category) : "other"
  if (!isExpenseCategory(category)) throw new CrudError("Categoría inválida", 400, "category")
  const paidFrom = input.paidFrom === "cash_register" || ctx.cashSessionId ? "cash_register" : "other"
  const locationId = await resolveLocation(organizationId, input.locationId)
  let session: { id: string; locationId: string } | null = null
  if (paidFrom === "cash_register") {
    if (ctx.cashSessionId) {
      session = await prisma.cashSession.findFirst({ where: { id: ctx.cashSessionId, organizationId, status: "open" }, select: { id: true, locationId: true } })
      if (!session) throw new CrudError("La caja ya no está abierta", 409, "paidFrom")
    } else {
      session = await openCashSessionFor(organizationId, locationId)
    }
  }

  const row = await prisma.expense.create({
    data: {
      organizationId,
      locationId: locationId ?? session?.locationId ?? null,
      category,
      description,
      amount,
      expenseDate: input.expenseDate ? parseExpenseDate(input.expenseDate) : parseExpenseDate(todayYmd()),
      paidFrom,
      cashSessionId: session?.id ?? null,
      supplierName: clean(input.supplierName, 190),
      receiptUrl: clean(input.receiptUrl, 190),
      notes: clean(input.notes, 2000),
      createdById: ctx.userId,
      employeeId: ctx.employeeId ?? null,
    },
    include: { location: { select: { name: true } } },
  })
  return serializeExpense(row)
}

async function assertEditable(organizationId: string, id: string) {
  const existing = await prisma.expense.findFirst({ where: { id, organizationId }, include: { cashSession: { select: { status: true } } } })
  if (!existing) throw new CrudError("Gasto no encontrado", 404)
  if (existing.paidFrom === "cash_register" && existing.cashSession && existing.cashSession.status !== "open") {
    throw new CrudError("Este gasto salió de una caja que ya tuvo corte; no se puede modificar.", 409)
  }
  return existing
}

export async function updateExpense(organizationId: string, id: string, input: ExpenseInput) {
  const existing = await assertEditable(organizationId, id)
  const data: Prisma.ExpenseUpdateInput = {}
  if (input.description !== undefined) {
    const description = clean(input.description, 190)
    if (!description) throw new CrudError("Escribe en qué se gastó", 400, "description")
    data.description = description
  }
  if (input.amount !== undefined) {
    const amount = Math.round(Number(input.amount) * 100) / 100
    if (!Number.isFinite(amount) || amount <= 0) throw new CrudError("El monto debe ser mayor que cero", 400, "amount")
    data.amount = amount
  }
  if (input.category !== undefined) {
    const category = String(input.category)
    if (!isExpenseCategory(category)) throw new CrudError("Categoría inválida", 400, "category")
    data.category = category
  }
  if (input.expenseDate !== undefined) data.expenseDate = parseExpenseDate(input.expenseDate)
  if (input.supplierName !== undefined) data.supplierName = clean(input.supplierName, 190)
  if (input.receiptUrl !== undefined) data.receiptUrl = clean(input.receiptUrl, 190)
  if (input.notes !== undefined) data.notes = clean(input.notes, 2000)
  // De dónde salió el dinero no se cambia después: afectaría un corte ya calculado.
  const row = await prisma.expense.update({ where: { id: existing.id }, data, include: { location: { select: { name: true } } } })
  return serializeExpense(row)
}

/** Anula el gasto (se conserva la historia). */
export async function voidExpense(organizationId: string, id: string) {
  const existing = await assertEditable(organizationId, id)
  await prisma.expense.update({ where: { id: existing.id }, data: { isActive: false } })
}

export async function restoreExpense(organizationId: string, id: string) {
  const existing = await assertEditable(organizationId, id)
  await prisma.expense.update({ where: { id: existing.id }, data: { isActive: true } })
}

/** Efectivo retirado de una caja (gastos activos pagados de la caja). */
export async function cashExpensesTotal(cashSessionId: string): Promise<number> {
  const agg = await prisma.expense.aggregate({
    where: { cashSessionId, paidFrom: "cash_register", isActive: true },
    _sum: { amount: true },
  })
  return num(agg._sum.amount)
}
