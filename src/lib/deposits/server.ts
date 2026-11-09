import { CONTAINER_MODES } from "@/lib/vertical-modes"
import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { round2 } from "@/lib/pos/money"

type Db = Prisma.TransactionClient | typeof prisma

/** Error de negocio con código HTTP (lo traduce la API). */
/** ¿El tipo de negocio maneja envases retornables? (tienda, restaurante/café e híbrido) */
export async function containersAvailable(organizationId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { businessMode: true } })
  return Boolean(org && CONTAINER_MODES.includes(org.businessMode))
}

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

/**
 * Una devolución de venta devuelve también el envase: las piezas devueltas liberan el pendiente SIN importe
 * pagado de esa venta (sin mover efectivo). El importe ya pagado se regresa desde «Recibir envases», donde el
 * cajero entrega el efectivo de forma explícita y queda en el corte.
 */
export async function releaseSaleContainers(
  tx: Prisma.TransactionClient,
  ctx: { organizationId: string; locationId: string; saleId: string; customerId?: string | null; userId?: string | null },
  items: { productId: string | null; quantity: number }[]
) {
  const wanted = new Map<string, number>()
  for (const item of items) {
    if (item.productId) wanted.set(item.productId, (wanted.get(item.productId) ?? 0) + Math.floor(item.quantity))
  }
  if (!wanted.size) return
  const grouped = await tx.depositEntry.groupBy({
    by: ["productId", "kind"],
    where: { organizationId: ctx.organizationId, saleId: ctx.saleId, productId: { in: [...wanted.keys()] }, kind: { in: ["owed", "settle"] } },
    _sum: { quantity: true },
  })
  const data: Prisma.DepositEntryCreateManyInput[] = []
  for (const [productId, qty] of wanted) {
    const sum = (kind: string) => grouped.find((g) => g.productId === productId && g.kind === kind)?._sum.quantity ?? 0
    const open = sum("owed") - sum("settle")
    const pieces = Math.min(qty, open)
    if (pieces <= 0) continue
    const sample = await tx.depositEntry.findFirst({ where: { organizationId: ctx.organizationId, saleId: ctx.saleId, productId, kind: "owed" }, select: { productName: true, unitAmount: true } })
    if (!sample) continue
    data.push({
      organizationId: ctx.organizationId,
      locationId: ctx.locationId,
      kind: "settle",
      productId,
      productName: sample.productName,
      quantity: pieces,
      unitAmount: sample.unitAmount,
      amount: 0,
      saleId: ctx.saleId,
      customerId: ctx.customerId ?? null,
      userId: ctx.userId ?? null,
    })
  }
  if (data.length) await tx.depositEntry.createMany({ data })
}

export interface CustomerContainerBalance {
  customerId: string
  customerName: string
  outstanding: number
  unpaid: number
  /** Importe pagado que se les regresa al devolver. */
  amount: number
  items: { productName: string; outstanding: number }[]
}

/** Saldo de envases por cliente identificado (quién debe qué). Solo informa; no bloquea ninguna venta. */
export async function getCustomerContainerBalances(organizationId: string, locationId: string): Promise<CustomerContainerBalance[]> {
  const grouped = await prisma.depositEntry.groupBy({
    by: ["customerId", "productId", "kind"],
    where: { organizationId, locationId, customerId: { not: null } },
    _sum: { quantity: true, amount: true },
  })
  const per = new Map<string, Map<string, { out: number; paidOut: number; unit: number }>>()
  for (const row of grouped) {
    const cid = row.customerId!
    const byProduct = per.get(cid) ?? new Map()
    const cur = byProduct.get(row.productId) ?? { out: 0, paidOut: 0, unit: 0 }
    const qty = row._sum.quantity ?? 0
    cur.out += (KIND_SIGN[row.kind] ?? 0) * qty
    if (row.kind === "charge") { cur.paidOut += qty; cur.unit = qty > 0 ? toNum(row._sum.amount) / qty : cur.unit }
    if (row.kind === "refund" || row.kind === "writeoff") cur.paidOut -= qty
    byProduct.set(row.productId, cur)
    per.set(cid, byProduct)
  }
  const pending = [...per.entries()]
    .map(([cid, products]) => ({ cid, products: [...products.entries()].filter(([, v]) => v.out > 0) }))
    .filter((c) => c.products.length)
  if (!pending.length) return []
  const [customers, products] = await Promise.all([
    prisma.customer.findMany({ where: { organizationId, id: { in: pending.map((c) => c.cid) } }, select: { id: true, fullName: true } }),
    prisma.product.findMany({ where: { organizationId, id: { in: [...new Set(pending.flatMap((c) => c.products.map(([id]) => id)))] } }, select: { id: true, name: true } }),
  ])
  const nameOf = new Map(customers.map((c) => [c.id, c.fullName]))
  const productName = new Map(products.map((p) => [p.id, p.name]))
  return pending
    .map((c) => {
      let outstanding = 0, unpaid = 0, amount = 0
      const items = c.products.map(([id, v]) => {
        const paid = Math.max(0, Math.min(v.out, v.paidOut))
        outstanding += v.out
        unpaid += v.out - paid
        amount += paid * v.unit
        return { productName: productName.get(id) ?? "Producto", outstanding: v.out }
      })
      return { customerId: c.cid, customerName: nameOf.get(c.cid) ?? "Cliente", outstanding, unpaid, amount: round2(amount), items }
    })
    .sort((a, b) => b.outstanding - a.outstanding)
}

/** Importe retenido por envases dados de baja (egreso por pagar al proveedor) de una sucursal. */
export async function getRetainedDeposits(organizationId: string, locationId: string) {
  const agg = await prisma.depositEntry.aggregate({
    where: { organizationId, locationId, kind: "writeoff" },
    _sum: { amount: true, quantity: true },
  })
  return { amount: round2(toNum(agg._sum.amount)), pieces: agg._sum.quantity ?? 0 }
}

/** Efectivo regresado por envases en una sesión de caja (para el corte). */
export async function depositCashRefunds(db: Db, cashSessionId: string): Promise<number> {
  const agg = await db.depositEntry.aggregate({
    where: { cashSessionId, kind: "refund" },
    _sum: { amount: true },
  })
  return round2(toNum(agg._sum.amount))
}
