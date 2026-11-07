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

/**
 * Registra en el libro los envases de una venta (dentro de su transacción): "charge" = importe cobrado,
 * "owed" = envases cuyo importe el cliente no pagó (quedan pendientes a su nombre, sin impedir la venta).
 */
export async function recordDepositCharges(
  tx: Prisma.TransactionClient,
  ctx: { organizationId: string; locationId: string; saleId: string; cashSessionId?: string | null; customerId?: string | null; userId?: string | null },
  lines: { productId: string; productName: string; unitAmount: number; paid: number; owed: number }[]
) {
  const data = lines.flatMap((line) =>
    ([["charge", line.paid], ["owed", line.owed]] as const)
      .filter(([, quantity]) => quantity > 0)
      .map(([kind, quantity]) => ({
        organizationId: ctx.organizationId,
        locationId: ctx.locationId,
        kind,
        productId: line.productId,
        productName: line.productName,
        quantity,
        unitAmount: line.unitAmount,
        amount: round2(quantity * line.unitAmount),
        saleId: ctx.saleId,
        cashSessionId: ctx.cashSessionId ?? null,
        customerId: ctx.customerId ?? null,
        userId: ctx.userId ?? null,
      }))
  )
  if (data.length) await tx.depositEntry.createMany({ data })
}

export interface ContainerBalance {
  productId: string
  productName: string
  unitAmount: number
  /** Envases que aún no regresan (cobrados o pendientes de pago). */
  outstanding: number
  /** De esos, los que tienen importe pagado: se regresa en efectivo al devolverlos. */
  paid: number
  /** De esos, los que el cliente no pagó: al devolverlos solo se cierra el pendiente. */
  unpaid: number
  /** Importe a regresar en efectivo por los envases pagados. */
  amount: number
}

// writeoff = envase que no regresó: el importe cobrado se queda en la tienda (se paga al proveedor).
const KIND_SIGN: Record<string, 1 | -1> = { charge: 1, owed: 1, refund: -1, settle: -1, writeoff: -1 }

/**
 * Envases en circulación: de la sucursal o, con `customerId`, los pendientes de ese cliente.
 * Solo informa; nunca bloquea una venta.
 */
export async function getContainerBalances(
  organizationId: string,
  locationId: string,
  customerId?: string | null
): Promise<ContainerBalance[]> {
  const grouped = await prisma.depositEntry.groupBy({
    by: ["productId", "kind"],
    where: { organizationId, locationId, ...(customerId ? { customerId } : {}) },
    _sum: { quantity: true },
  })
  const per = new Map<string, { out: number; paidOut: number }>()
  for (const row of grouped) {
    const qty = row._sum.quantity ?? 0
    const cur = per.get(row.productId) ?? { out: 0, paidOut: 0 }
    cur.out += (KIND_SIGN[row.kind] ?? 0) * qty
    if (row.kind === "charge") cur.paidOut += qty
    if (row.kind === "refund" || row.kind === "writeoff") cur.paidOut -= qty
    per.set(row.productId, cur)
  }
  const ids = [...per.entries()].filter(([, v]) => v.out > 0).map(([id]) => id)
  if (!ids.length) return []
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, organizationId },
    select: { id: true, name: true, depositAmount: true },
  })
  return products
    .map((p) => {
      const v = per.get(p.id)!
      const paid = Math.max(0, Math.min(v.out, v.paidOut))
      const unitAmount = toNum(p.depositAmount)
      return { productId: p.id, productName: p.name, unitAmount, outstanding: v.out, paid, unpaid: v.out - paid, amount: round2(paid * unitAmount) }
    })
    .sort((a, b) => a.productName.localeCompare(b.productName, "es"))
}

/**
 * Recibe envases devueltos. Los que tenían importe pagado se regresan en efectivo (sale de la caja y queda
 * en el corte); los que el cliente no pagó solo cierran el pendiente. No se reciben más de los pendientes.
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

    const grouped = await tx.depositEntry.groupBy({
      by: ["kind"],
      where: { organizationId, locationId, productId: product.id },
      _sum: { quantity: true },
    })
    const sum = (kind: string) => grouped.find((g) => g.kind === kind)?._sum.quantity ?? 0
    const outstanding = sum("charge") + sum("owed") - sum("refund") - sum("settle") - sum("writeoff")
    if (input.quantity > outstanding) {
      throw new DepositError(`Solo hay ${Math.max(0, outstanding)} envase(s) de ${product.name} pendientes de devolver`, 409)
    }
    const cashPieces = Math.min(input.quantity, Math.max(0, sum("charge") - sum("refund") - sum("writeoff")))
    const settlePieces = input.quantity - cashPieces

    let session: { id: string } | null = null
    if (cashPieces > 0) {
      session = await tx.cashSession.findFirst({
        where: { organizationId, cashRegister: { locationId }, status: "open" },
        orderBy: { openedAt: "desc" },
        select: { id: true },
      })
      if (!session) throw new DepositError("Abre la caja para regresar el importe en efectivo", 409)
    }
    // Se regresa lo que se cobró: el último importe cobrado, no el actual del catálogo.
    const lastCharge = await tx.depositEntry.findFirst({
      where: { organizationId, locationId, productId: product.id, kind: "charge" },
      orderBy: { createdAt: "desc" },
      select: { unitAmount: true },
    })
    const unitAmount = toNum(lastCharge?.unitAmount ?? product.depositAmount)
    const amount = round2(unitAmount * cashPieces)
    const base = { organizationId, locationId, productId: product.id, productName: product.name, customerId: input.customerId ?? null, userId: ctx.userId }
    let id = ""
    if (cashPieces > 0) {
      const entry = await tx.depositEntry.create({
        data: { ...base, kind: "refund", quantity: cashPieces, unitAmount, amount, cashSessionId: session!.id },
      })
      id = entry.id
    }
    if (settlePieces > 0) {
      const entry = await tx.depositEntry.create({
        data: { ...base, kind: "settle", quantity: settlePieces, unitAmount: toNum(product.depositAmount), amount: 0 },
      })
      id = id || entry.id
    }
    return { id, productName: product.name, quantity: input.quantity, amount, settled: settlePieces, pending: outstanding - input.quantity }
  })
}

/**
 * Da de baja envases que el cliente no regresó: el importe que ya se cobró se queda en la tienda (pasa al
 * proveedor como egreso) y ya no se regresa. Los que nunca tuvieron importe pagado solo cierran el pendiente.
 */
export async function writeOffContainers(
  organizationId: string,
  locationId: string,
  input: { productId: string; quantity: number; reason?: string | null },
  ctx: { userId: string }
) {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0 || input.quantity > 100000) {
    throw new DepositError("Indica cuántos envases das de baja")
  }
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: input.productId, organizationId, depositAmount: { gt: 0 } },
      select: { id: true, name: true, depositAmount: true },
    })
    if (!product) throw new DepositError("Ese producto no maneja importe de envase", 404)
    const grouped = await tx.depositEntry.groupBy({
      by: ["kind"],
      where: { organizationId, locationId, productId: product.id },
      _sum: { quantity: true },
    })
    const sum = (kind: string) => grouped.find((g) => g.kind === kind)?._sum.quantity ?? 0
    const outstanding = sum("charge") + sum("owed") - sum("refund") - sum("settle") - sum("writeoff")
    if (input.quantity > outstanding) {
      throw new DepositError(`Solo hay ${Math.max(0, outstanding)} envase(s) de ${product.name} pendientes`, 409)
    }
    const retainedPieces = Math.min(input.quantity, Math.max(0, sum("charge") - sum("refund") - sum("writeoff")))
    const settlePieces = input.quantity - retainedPieces
    const lastCharge = await tx.depositEntry.findFirst({
      where: { organizationId, locationId, productId: product.id, kind: "charge" },
      orderBy: { createdAt: "desc" },
      select: { unitAmount: true },
    })
    const unitAmount = toNum(lastCharge?.unitAmount ?? product.depositAmount)
    const base = { organizationId, locationId, productId: product.id, productName: product.name, userId: ctx.userId }
    const amount = round2(unitAmount * retainedPieces)
    if (retainedPieces > 0) {
      await tx.depositEntry.create({ data: { ...base, kind: "writeoff", quantity: retainedPieces, unitAmount, amount } })
    }
    if (settlePieces > 0) {
      await tx.depositEntry.create({ data: { ...base, kind: "settle", quantity: settlePieces, unitAmount: toNum(product.depositAmount), amount: 0 } })
    }
    return { productName: product.name, quantity: input.quantity, retained: amount, settled: settlePieces, pending: outstanding - input.quantity }
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
