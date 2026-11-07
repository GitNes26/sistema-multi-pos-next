import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { round2 } from "@/lib/pos/money"

type Db = Prisma.TransactionClient | typeof prisma

/** Error de negocio con código HTTP (lo traduce la API). */
export class DepositError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message)
  }
}

export interface ContainerInput {
  productId: string
  /** Envases que el cliente trae a cambio: no pagan importe. */
  brought: number
}

export interface DepositLine {
  productId: string
  productName: string
  unitAmount: number
  /** Piezas vendidas del producto. */
  units: number
  /** Envases que trae el cliente (canje). */
  brought: number
  /** Envases por los que se cobra importe: vendidas − traídas. */
  charged: number
  amount: number
}

const toNum = (v: unknown) => (v == null ? 0 : Number(v))

/**
 * Importe de envases de un ticket. El cliente solo propone cuántos envases trae; el importe unitario y
 * las piezas salen siempre del catálogo y de las partidas del ticket.
 */
export async function computeContainerDeposit(
  db: Db,
  organizationId: string,
  items: { productId: string; quantity: number }[],
  containers: ContainerInput[] = []
): Promise<{ total: number; lines: DepositLine[] }> {
  const unitsByProduct = new Map<string, number>()
  for (const item of items) {
    unitsByProduct.set(item.productId, (unitsByProduct.get(item.productId) ?? 0) + item.quantity)
  }
  const proposed = new Map<string, number>()
  for (const entry of containers) {
    if (!Number.isInteger(entry.brought) || entry.brought < 0) throw new DepositError("Cantidad de envases inválida")
    proposed.set(entry.productId, (proposed.get(entry.productId) ?? 0) + entry.brought)
  }
  const ids = [...unitsByProduct.keys()]
  const products = ids.length
    ? await db.product.findMany({
        where: { id: { in: ids }, organizationId, isActive: true, depositAmount: { gt: 0 }, productType: "standard" },
        select: { id: true, name: true, depositAmount: true },
      })
    : []
  const known = new Set(products.map((p) => p.id))
  for (const productId of proposed.keys()) {
    if (!known.has(productId)) throw new DepositError("Ese producto no maneja importe de envase")
  }
  const lines: DepositLine[] = []
  for (const product of products) {
    const units = Math.floor(unitsByProduct.get(product.id) ?? 0)
    if (units <= 0) continue
    const brought = proposed.get(product.id) ?? 0
    if (brought > units) throw new DepositError(`${product.name}: no puedes traer más envases (${brought}) que piezas compradas (${units})`)
    const unitAmount = toNum(product.depositAmount)
    const charged = units - brought
    lines.push({ productId: product.id, productName: product.name, unitAmount, units, brought, charged, amount: round2(charged * unitAmount) })
  }
  return { total: round2(lines.reduce((sum, line) => sum + line.amount, 0)), lines }
}

/** Registra en el libro los envases cobrados con una venta (dentro de su transacción). */
export async function recordDepositCharges(
  tx: Prisma.TransactionClient,
  ctx: { organizationId: string; locationId: string; saleId: string; cashSessionId?: string | null; customerId?: string | null; userId?: string | null },
  lines: DepositLine[]
) {
  const data = lines
    .filter((line) => line.charged > 0)
    .map((line) => ({
      organizationId: ctx.organizationId,
      locationId: ctx.locationId,
      kind: "charge",
      productId: line.productId,
      productName: line.productName,
      quantity: line.charged,
      unitAmount: line.unitAmount,
      amount: line.amount,
      saleId: ctx.saleId,
      cashSessionId: ctx.cashSessionId ?? null,
      customerId: ctx.customerId ?? null,
      userId: ctx.userId ?? null,
    }))
  if (data.length) await tx.depositEntry.createMany({ data })
}

export interface ContainerBalance {
  productId: string
  productName: string
  unitAmount: number
  /** Envases cobrados que aún no se devuelven. */
  outstanding: number
  amount: number
}

/** Envases en circulación de la sucursal: cobrados menos devueltos, por producto. */
export async function getContainerBalances(organizationId: string, locationId: string): Promise<ContainerBalance[]> {
  const grouped = await prisma.depositEntry.groupBy({
    by: ["productId", "kind"],
    where: { organizationId, locationId },
    _sum: { quantity: true },
  })
  const balance = new Map<string, number>()
  for (const row of grouped) {
    const qty = row._sum.quantity ?? 0
    balance.set(row.productId, (balance.get(row.productId) ?? 0) + (row.kind === "charge" ? qty : -qty))
  }
  const ids = [...balance.entries()].filter(([, qty]) => qty > 0).map(([id]) => id)
  if (!ids.length) return []
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, organizationId },
    select: { id: true, name: true, depositAmount: true },
  })
  return products
    .map((p) => {
      const outstanding = balance.get(p.id) ?? 0
      const unitAmount = toNum(p.depositAmount)
      return { productId: p.id, productName: p.name, unitAmount, outstanding, amount: round2(outstanding * unitAmount) }
    })
    .sort((a, b) => a.productName.localeCompare(b.productName, "es"))
}

/**
 * Recibe envases devueltos y regresa su importe en efectivo (sale de la caja y queda en el corte).
 * No se pueden devolver más envases de los cobrados y aún pendientes en la sucursal.
 */
export async function refundContainers(
  organizationId: string,
  locationId: string,
  input: { productId: string; quantity: number; customerId?: string | null },
  ctx: { userId: string }
) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0 || input.quantity > 10000) {
    throw new DepositError("Indica cuántos envases devuelve")
  }
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: input.productId, organizationId, depositAmount: { gt: 0 } },
      select: { id: true, name: true, depositAmount: true },
    })
    if (!product) throw new DepositError("Ese producto no maneja importe de envase", 404)

    const session = await tx.cashSession.findFirst({
      where: { organizationId, cashRegister: { locationId }, status: "open" },
      orderBy: { openedAt: "desc" },
      select: { id: true },
    })
    if (!session) throw new DepositError("Abre la caja para regresar el importe en efectivo", 409)
    const grouped = await tx.depositEntry.groupBy({
      by: ["kind"],
      where: { organizationId, locationId, productId: product.id },
      _sum: { quantity: true },
    })
    const sum = (kind: string) => grouped.find((g) => g.kind === kind)?._sum.quantity ?? 0
    const outstanding = sum("charge") - sum("refund")
    if (input.quantity > outstanding) {
      throw new DepositError(`Solo hay ${Math.max(0, outstanding)} envase(s) de ${product.name} pendientes de devolver`, 409)
    }
    // Se regresa lo que se cobró: el último importe cobrado, no el actual del catálogo.
    const lastCharge = await tx.depositEntry.findFirst({
      where: { organizationId, locationId, productId: product.id, kind: "charge" },
      orderBy: { createdAt: "desc" },
      select: { unitAmount: true },
    })
    const unitAmount = toNum(lastCharge?.unitAmount ?? product.depositAmount)
    const amount = round2(unitAmount * input.quantity)
    const entry = await tx.depositEntry.create({
      data: {
        organizationId,
        locationId,
        kind: "refund",
        productId: product.id,
        productName: product.name,
        quantity: input.quantity,
        unitAmount,
        amount,
        cashSessionId: session.id,
        customerId: input.customerId ?? null,
        userId: ctx.userId,
      },
    })
    return { id: entry.id, productName: product.name, quantity: input.quantity, amount, pending: outstanding - input.quantity }
  })
}

/** Efectivo regresado por envases en una sesión de caja (para el corte). */
export async function depositCashRefunds(db: Db, cashSessionId: string): Promise<number> {
  const agg = await db.depositEntry.aggregate({
    where: { cashSessionId, kind: "refund" },
    _sum: { amount: true },
  })
  return round2(toNum(agg._sum.amount))
}
