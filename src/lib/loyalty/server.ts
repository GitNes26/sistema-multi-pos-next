import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { notifyCustomer } from "@/lib/notifications/customer-channels"
import { presetByKey, type LoyaltyKind } from "./presets"
import { redemptionAmount } from "./redeem"

// Programas de fidelidad (tarjeta de visitas, paquetes prepagados y membresías). Todos generan «créditos» que
// el cliente canjea en una venta: el POS propone el descuento y el servidor lo valida contra el saldo antes
// de cobrar. La membresía además tiene vigencia: pasado su vencimiento los créditos dejan de valer.

export class LoyaltyError extends Error {
  status: number
  field?: string
  constructor(message: string, status = 400, field?: string) {
    super(message)
    this.status = status
    this.field = field
  }
}

type Db = Prisma.TransactionClient | typeof prisma

const DAY_MS = 86_400_000

export interface LoyaltyProgramDto {
  id: string
  kind: LoyaltyKind
  presetKey: string | null
  name: string
  description: string | null
  isActive: boolean
  visitsRequired: number | null
  packUses: number | null
  packProductId: string | null
  packProductName: string | null
  targetProductIds: string[]
  targetProductNames: string[]
  discountPercent: number
  periodDays: number | null
  rollover: boolean
  reminderDays: number
  terms: string | null
  /** Clientes con créditos vigentes / créditos en circulación (para que el dueño vea cuánto debe). */
  customersWithCredits: number
  creditsOutstanding: number
  /** Membresías: clientes con periodo vigente. */
  activeMembers: number
}

const asIds = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [])
const isPackLike = (kind: string) => kind === "prepaid_pack" || kind === "membership"

/** Créditos que de verdad se pueden usar hoy (los de una membresía vencida ya no valen). */
export function usableCredits(kind: string, card: { credits: number; expiresAt: Date | null } | null | undefined, now = new Date()): number {
  if (!card) return 0
  if (kind === "membership" && (!card.expiresAt || card.expiresAt.getTime() <= now.getTime())) return 0
  return card.credits
}

export async function listLoyaltyPrograms(organizationId: string): Promise<LoyaltyProgramDto[]> {
  const now = new Date()
  const rows = await prisma.loyaltyProgram.findMany({ where: { organizationId }, orderBy: [{ isActive: "desc" }, { createdAt: "asc" }] })
  const productIds = [...new Set(rows.flatMap((r) => [...asIds(r.targetProductIds), ...(r.packProductId ? [r.packProductId] : [])]))]
  const [products, cards] = await Promise.all([
    productIds.length ? prisma.product.findMany({ where: { organizationId, id: { in: productIds } }, select: { id: true, name: true } }) : [],
    prisma.loyaltyCard.findMany({ where: { organizationId, credits: { gt: 0 } }, select: { programId: true, credits: true, expiresAt: true } }),
  ])
  const memberCards = await prisma.loyaltyCard.groupBy({ by: ["programId"], where: { organizationId, expiresAt: { gt: now } }, _count: { _all: true } })
  const name = new Map(products.map((p) => [p.id, p.name]))
  const members = new Map(memberCards.map((m) => [m.programId, m._count._all]))
  return rows.map((r) => {
    const targets = asIds(r.targetProductIds)
    const mine = cards.filter((c) => c.programId === r.id).map((c) => usableCredits(r.kind, c, now)).filter((n) => n > 0)
    return {
      id: r.id,
      kind: r.kind as LoyaltyKind,
      presetKey: r.presetKey,
      name: r.name,
      description: r.description,
      isActive: r.isActive,
      visitsRequired: r.visitsRequired,
      packUses: r.packUses,
      packProductId: r.packProductId,
      packProductName: r.packProductId ? (name.get(r.packProductId) ?? null) : null,
      targetProductIds: targets,
      targetProductNames: targets.map((id) => name.get(id) ?? "Producto eliminado"),
      discountPercent: r.discountPercent,
      periodDays: r.periodDays,
      rollover: r.rollover,
      reminderDays: r.reminderDays,
      terms: r.terms,
      customersWithCredits: mine.length,
      creditsOutstanding: mine.reduce((a, b) => a + b, 0),
      activeMembers: r.kind === "membership" ? (members.get(r.id) ?? 0) : 0,
    }
  })
}

export interface LoyaltyProgramInput {
  kind?: unknown
  presetKey?: unknown
  name?: unknown
  description?: unknown
  isActive?: unknown
  visitsRequired?: unknown
  packUses?: unknown
  packProductId?: unknown
  targetProductIds?: unknown
  discountPercent?: unknown
  periodDays?: unknown
  rollover?: unknown
  reminderDays?: unknown
  terms?: unknown
}

const intIn = (v: unknown, label: string, min: number, max: number, field: string) => {
  const n = Number(v)
  if (!Number.isInteger(n) || n < min || n > max) throw new LoyaltyError(`${label}: ingresa un número entero entre ${min} y ${max}`, 400, field)
  return n
}

/** Crea o actualiza un programa validando todo contra la empresa activa. */
export async function saveLoyaltyProgram(organizationId: string, input: LoyaltyProgramInput, id?: string) {
  const current = id ? await prisma.loyaltyProgram.findFirst({ where: { id, organizationId } }) : null
  if (id && !current) throw new LoyaltyError("Programa no encontrado", 404)
  const kind = (input.kind ?? current?.kind) as LoyaltyKind
  if (kind !== "visit_card" && kind !== "prepaid_pack" && kind !== "membership") throw new LoyaltyError("Elige el tipo de programa", 400, "kind")
  const name = String(input.name ?? current?.name ?? "").trim()
  if (name.length < 2 || name.length > 80) throw new LoyaltyError("El nombre debe tener entre 2 y 80 caracteres", 400, "name")
  const discountPercent = intIn(input.discountPercent ?? current?.discountPercent ?? 100, "El porcentaje que cubre cada crédito", 1, 100, "discountPercent")

  const targetProductIds = [...new Set(asIds(input.targetProductIds ?? current?.targetProductIds))]
  if (targetProductIds.length) {
    const found = await prisma.product.count({ where: { organizationId, id: { in: targetProductIds } } })
    if (found !== targetProductIds.length) throw new LoyaltyError("Algún producto o servicio no pertenece a la empresa activa", 400, "targetProductIds")
  }

  let visitsRequired: number | null = null
  let packUses: number | null = null
  let packProductId: string | null = null
  let periodDays: number | null = null
  let reminderDays = 3
  let rollover = false
  let terms: string | null = null
  if (kind === "visit_card") {
    visitsRequired = intIn(input.visitsRequired ?? current?.visitsRequired, "Las visitas necesarias", 2, 100, "visitsRequired")
  } else {
    packUses = intIn(input.packUses ?? current?.packUses, kind === "membership" ? "Los servicios por periodo" : "Los servicios del paquete", 1, 100, "packUses")
    const wanted = input.packProductId ?? current?.packProductId
    packProductId = typeof wanted === "string" && wanted ? wanted : null
    if (!packProductId) throw new LoyaltyError(kind === "membership" ? "Elige el producto que representa la cuota de la membresía (el que se cobra cada mes)" : "Elige el producto que representa el paquete (el que se cobra al venderlo)", 400, "packProductId")
    const pack = await prisma.product.findFirst({ where: { id: packProductId, organizationId }, select: { id: true } })
    if (!pack) throw new LoyaltyError("El producto no pertenece a la empresa activa", 400, "packProductId")
    if (targetProductIds.includes(packProductId)) throw new LoyaltyError("La cuota o paquete no puede canjearse por sí mismo", 400, "targetProductIds")
    const dup = await prisma.loyaltyProgram.findFirst({ where: { organizationId, kind: { in: ["prepaid_pack", "membership"] }, packProductId, ...(id ? { id: { not: id } } : {}) }, select: { name: true } })
    if (dup) throw new LoyaltyError(`Ese producto ya es el paquete o la cuota de «${dup.name}»`, 409, "packProductId")
    if (kind === "membership") {
      periodDays = intIn(input.periodDays ?? current?.periodDays ?? 30, "Los días de cada periodo", 1, 366, "periodDays")
      reminderDays = intIn(input.reminderDays ?? current?.reminderDays ?? 3, "Los días de aviso antes de vencer", 0, 60, "reminderDays")
      rollover = input.rollover !== undefined ? Boolean(input.rollover) : (current?.rollover ?? false)
      const rawTerms = input.terms !== undefined ? String(input.terms ?? "") : (current?.terms ?? "")
      if (rawTerms.length > 2000) throw new LoyaltyError("Las condiciones son demasiado largas (máximo 2000 caracteres)", 400, "terms")
      terms = rawTerms.trim() || null
    }
  }
  const preset = presetByKey(typeof input.presetKey === "string" ? input.presetKey : current?.presetKey)
  const data = {
    kind,
    presetKey: preset?.key ?? null,
    name,
    description: input.description !== undefined ? (String(input.description ?? "").trim().slice(0, 190) || null) : (current?.description ?? null),
    isActive: input.isActive !== undefined ? Boolean(input.isActive) : (current?.isActive ?? true),
    visitsRequired,
    packUses,
    packProductId,
    targetProductIds,
    discountPercent,
    periodDays,
    rollover,
    reminderDays,
    terms,
  }
  if (current) return prisma.loyaltyProgram.update({ where: { id: current.id }, data })
  return prisma.loyaltyProgram.create({ data: { organizationId, ...data } })
}

export interface CustomerCredit {
  programId: string
  name: string
  kind: LoyaltyKind
  /** Créditos que se pueden usar hoy. */
  credits: number
  visits: number
  visitsRequired: number | null
  targetProductIds: string[]
  excludeProductIds: string[]
  discountPercent: number
  /** Membresía: estado, vigencia, condiciones y lo que incluye cada periodo. */
  membership: null | {
    status: "none" | "active" | "expired"
    startedAt: string | null
    expiresAt: string | null
    daysLeft: number | null
    creditsPerPeriod: number | null
    periodDays: number | null
    rollover: boolean
    price: number | null
    terms: string | null
    targetProductNames: string[]
  }
}

/** Programas activos con lo que tiene un cliente (créditos, avance de visitas y vigencia de la membresía). */
export async function getCustomerLoyalty(organizationId: string, customerId: string): Promise<CustomerCredit[]> {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, organizationId }, select: { id: true } })
  if (!customer) throw new LoyaltyError("Cliente no encontrado", 404)
  const now = new Date()
  const [programs, cards] = await Promise.all([
    prisma.loyaltyProgram.findMany({ where: { organizationId, isActive: true }, orderBy: { createdAt: "asc" } }),
    prisma.loyaltyCard.findMany({ where: { organizationId, customerId } }),
  ])
  const packIds = programs.filter((p) => p.packProductId).map((p) => p.packProductId as string)
  const byProgram = new Map(cards.map((c) => [c.programId, c]))
  const ids = [...new Set(programs.filter((p) => p.kind === "membership").flatMap((p) => [...asIds(p.targetProductIds), ...(p.packProductId ? [p.packProductId] : [])]))]
  const [products, prices] = ids.length
    ? await Promise.all([
        prisma.product.findMany({ where: { organizationId, id: { in: ids } }, select: { id: true, name: true } }),
        prisma.productVariant.findMany({ where: { organizationId, productId: { in: ids }, isActive: true }, select: { productId: true, price: true }, orderBy: { createdAt: "asc" } }),
      ])
    : [[], []]
  const nameOf = new Map(products.map((p) => [p.id, p.name]))
  const priceOf = new Map<string, number>()
  for (const v of prices) if (!priceOf.has(v.productId)) priceOf.set(v.productId, Number(v.price))
  return programs.map((p) => {
    const card = byProgram.get(p.id)
    const targets = asIds(p.targetProductIds)
    let membership: CustomerCredit["membership"] = null
    if (p.kind === "membership") {
      const expires = card?.expiresAt ?? null
      const status = !expires ? "none" : expires.getTime() > now.getTime() ? "active" : "expired"
      membership = {
        status,
        startedAt: card?.startedAt?.toISOString() ?? null,
        expiresAt: expires?.toISOString() ?? null,
        daysLeft: expires && status === "active" ? Math.max(0, Math.ceil((expires.getTime() - now.getTime()) / DAY_MS)) : null,
        creditsPerPeriod: p.packUses,
        periodDays: p.periodDays,
        rollover: p.rollover,
        price: p.packProductId ? (priceOf.get(p.packProductId) ?? null) : null,
        terms: p.terms,
        targetProductNames: targets.map((id) => nameOf.get(id) ?? "Producto eliminado"),
      }
    }
    return {
      programId: p.id,
      name: p.name,
      kind: p.kind as LoyaltyKind,
      credits: usableCredits(p.kind, card, now),
      visits: card?.visits ?? 0,
      visitsRequired: p.visitsRequired,
      targetProductIds: targets,
      excludeProductIds: packIds,
      discountPercent: p.discountPercent,
      membership,
    }
  })
}

interface SaleLine {
  productId: string
  quantity: number
  unitPrice: number
}

/** Antes de cobrar: cada canje debe tener crédito vigente y el monto exacto que calcula el servidor. */
export async function validateLoyaltyRedemptions(
  organizationId: string,
  input: { customerId?: string | null; items: SaleLine[]; discounts: { loyaltyProgramId?: string; amount: number }[] }
): Promise<string[]> {
  const redeems = input.discounts.filter((d) => d.loyaltyProgramId)
  if (!redeems.length) return []
  if (!input.customerId) throw new LoyaltyError("Para canjear una recompensa elige al cliente", 400)
  const ids = redeems.map((d) => d.loyaltyProgramId as string)
  if (new Set(ids).size !== ids.length) throw new LoyaltyError("Cada recompensa se canjea una sola vez por venta", 400)
  const programs = await prisma.loyaltyProgram.findMany({ where: { organizationId, isActive: true } })
  const packIds = programs.filter((p) => p.packProductId).map((p) => p.packProductId as string)
  const lines = input.items.flatMap((i) => Array.from({ length: Math.max(1, Math.floor(i.quantity)) }, () => ({ productId: i.productId, unitPrice: i.unitPrice })))
  for (const d of redeems) {
    const program = programs.find((p) => p.id === d.loyaltyProgramId)
    if (!program) throw new LoyaltyError("La recompensa ya no está disponible", 409)
    const card = await prisma.loyaltyCard.findUnique({ where: { customerId_programId: { customerId: input.customerId, programId: program.id } } })
    if (card && card.organizationId !== organizationId) throw new LoyaltyError("Recompensa no disponible", 409)
    if (program.kind === "membership" && card && usableCredits(program.kind, card) < 1 && card.credits > 0) throw new LoyaltyError(`La membresía «${program.name}» de este cliente venció`, 409)
    if (usableCredits(program.kind, card) < 1) throw new LoyaltyError(`El cliente no tiene créditos de «${program.name}»`, 409)
    const expected = redemptionAmount(lines, asIds(program.targetProductIds), program.discountPercent, packIds)
    if (expected <= 0) throw new LoyaltyError(`En este ticket no hay nada que canjear con «${program.name}»`, 409)
    if (Math.abs(d.amount - expected) > 0.01) throw new LoyaltyError("El descuento de la recompensa no coincide con el cálculo del servidor", 400)
  }
  return ids
}

/** Dentro de la transacción de la venta: descuenta canjes y acumula visitas, paquetes o periodos de membresía. */
export async function applyLoyaltyToSale(
  tx: Db,
  args: { organizationId: string; customerId?: string | null; saleId: string; items: SaleLine[]; redeemedProgramIds: string[] }
) {
  const { organizationId, customerId, saleId } = args
  if (!customerId) return
  const programs = await tx.loyaltyProgram.findMany({ where: { organizationId, isActive: true } })
  if (!programs.length) return
  const packIds = programs.filter((p) => p.packProductId).map((p) => p.packProductId as string)
  const now = new Date()

  const cardFor = (programId: string) =>
    tx.loyaltyCard.upsert({
      where: { customerId_programId: { customerId, programId } },
      create: { organizationId, customerId, programId },
      update: {},
    })

  for (const program of programs) {
    const redeemed = args.redeemedProgramIds.includes(program.id)
    if (redeemed) {
      const card = await cardFor(program.id)
      const used = await tx.loyaltyCard.updateMany({
        where: { id: card.id, credits: { gte: 1 }, ...(program.kind === "membership" ? { expiresAt: { gt: now } } : {}) },
        data: { credits: { decrement: 1 } },
      })
      if (!used.count) throw new LoyaltyError(`El cliente ya no tiene créditos vigentes de «${program.name}»`, 409)
      await tx.loyaltyMovement.create({ data: { organizationId, cardId: card.id, type: "redeem", delta: -1, saleId } })
    }

    if (program.kind === "visit_card" && program.visitsRequired) {
      // Una venta cuenta como una visita (no si en ella se canjeó el mismo programa, para no encadenar premios).
      const targets = asIds(program.targetProductIds)
      const counts = !redeemed && args.items.some((i) => !packIds.includes(i.productId) && (targets.length === 0 || targets.includes(i.productId)))
      if (!counts) continue
      const card = await cardFor(program.id)
      const bumped = await tx.loyaltyCard.update({ where: { id: card.id }, data: { visits: { increment: 1 } } })
      await tx.loyaltyMovement.create({ data: { organizationId, cardId: card.id, type: "visit", delta: 1, saleId } })
      const earned = Math.floor(bumped.visits / program.visitsRequired)
      if (earned > 0) {
        await tx.loyaltyCard.update({ where: { id: card.id }, data: { visits: { decrement: earned * program.visitsRequired }, credits: { increment: earned } } })
        await tx.loyaltyMovement.create({ data: { organizationId, cardId: card.id, type: "earn", delta: earned, saleId, note: program.name } })
      }
    }

    if (program.kind === "prepaid_pack" && program.packProductId && program.packUses) {
      const bought = args.items.filter((i) => i.productId === program.packProductId).reduce((sum, i) => sum + Math.floor(i.quantity), 0)
      if (bought < 1) continue
      const card = await cardFor(program.id)
      const credits = bought * program.packUses
      await tx.loyaltyCard.update({ where: { id: card.id }, data: { credits: { increment: credits } } })
      await tx.loyaltyMovement.create({ data: { organizationId, cardId: card.id, type: "purchase", delta: credits, saleId, note: program.name } })
    }

    if (program.kind === "membership" && program.packProductId && program.packUses && program.periodDays) {
      // Cada cuota cobrada alta o renueva un periodo. Renovar a tiempo suma el periodo al vencimiento actual;
      // si ya venció, el periodo cuenta desde hoy. Los créditos sin usar pasan solo si el dueño lo permite.
      const bought = args.items.filter((i) => i.productId === program.packProductId).reduce((sum, i) => sum + Math.floor(i.quantity), 0)
      if (bought < 1) continue
      const card = await cardFor(program.id)
      const active = Boolean(card.expiresAt && card.expiresAt.getTime() > now.getTime())
      const base = active ? (card.expiresAt as Date) : now
      const expiresAt = new Date(base.getTime() + bought * program.periodDays * DAY_MS)
      const carried = active && program.rollover ? card.credits : 0
      const credits = carried + bought * program.packUses
      await tx.loyaltyCard.update({
        where: { id: card.id },
        data: { credits, expiresAt, startedAt: active ? (card.startedAt ?? now) : now, reminderSentAt: null },
      })
      await tx.loyaltyMovement.create({ data: { organizationId, cardId: card.id, type: "purchase", delta: credits - (active ? card.credits : 0), saleId, note: `${active ? "Renovación" : "Alta"} · ${program.name}` } })
    }
  }
}

/** Leyendas para el ticket de una venta: membresías dadas de alta o renovadas y créditos canjeados. */
export async function loyaltyTicketLines(organizationId: string, saleId: string): Promise<string[]> {
  const movements = await prisma.loyaltyMovement.findMany({
    where: { organizationId, saleId, type: { in: ["purchase", "redeem", "earn"] } },
    include: { card: { include: { program: true } } },
    orderBy: { createdAt: "asc" },
  })
  const lines: string[] = []
  const seen = new Set<string>()
  for (const m of movements) {
    const program = m.card.program
    if (seen.has(`${m.cardId}:${m.type}`)) continue
    seen.add(`${m.cardId}:${m.type}`)
    const left = usableCredits(program.kind, m.card)
    const until = m.card.expiresAt ? ` · vigente hasta ${m.card.expiresAt.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}` : ""
    if (m.type === "purchase" && program.kind === "membership") lines.push(`${program.name}${until} · ${left} servicio(s) disponibles`)
    else if (m.type === "purchase") lines.push(`${program.name}: ${left} servicio(s) disponibles`)
    else if (m.type === "redeem") lines.push(`Recompensa canjeada (${program.name}) · te quedan ${left}${until}`)
    else if (m.type === "earn") lines.push(`¡Ganaste una recompensa! ${program.name} · tienes ${left}`)
  }
  return lines
}

/**
 * Aviso a los clientes cuya membresía vence pronto (según los días de aviso de cada programa). Se manda una sola vez
 * por periodo. Pensado para correrse a diario desde el cron; `organizationId` limita a una empresa.
 */
export async function sweepMembershipReminders(organizationId?: string, now = new Date()): Promise<{ notified: number }> {
  const programs = await prisma.loyaltyProgram.findMany({ where: { kind: "membership", isActive: true, ...(organizationId ? { organizationId } : {}) } })
  let notified = 0
  for (const program of programs) {
    const limit = new Date(now.getTime() + program.reminderDays * DAY_MS)
    const cards = await prisma.loyaltyCard.findMany({ where: { programId: program.id, reminderSentAt: null, expiresAt: { gt: now, lte: limit } }, take: 500 })
    for (const card of cards) {
      const days = Math.max(1, Math.ceil(((card.expiresAt as Date).getTime() - now.getTime()) / DAY_MS))
      const claimed = await prisma.loyaltyCard.updateMany({ where: { id: card.id, reminderSentAt: null }, data: { reminderSentAt: now } })
      if (!claimed.count) continue
      await notifyCustomer({
        organizationId: program.organizationId,
        customerId: card.customerId,
        kind: "membership_expiring",
        title: `Tu membresía vence en ${days} ${days === 1 ? "día" : "días"}`,
        body: `${program.name}: te ${card.credits === 1 ? "queda 1 servicio" : `quedan ${card.credits} servicios`}. Renueva a tiempo${program.rollover ? " para conservarlos" : ""}.`,
        link: "/portal/loyalty",
      })
      notified += 1
    }
  }
  return { notified }
}
