import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { notifyCustomer } from "@/lib/notifications/customer-channels"
import { presetByKey, type LoyaltyKind } from "./presets"
import { redemptionAmount } from "./redeem"
import { LOYALTY_KIND_MODES, LOYALTY_KIND_NAMES, notForModeMessage, type LoyaltyKindKey } from "@/lib/vertical-modes"

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
  /** Cobro automático elegido para esta membresía (solo se puede si la plataforma lo desbloqueó). */
  autoBilling: boolean
  /** Clientes con créditos vigentes / créditos en circulación (para que el dueño vea cuánto debe). */
  customersWithCredits: number
  creditsOutstanding: number
  /** Membresías: clientes con periodo vigente. */
  activeMembers: number
}

/** Tipo de negocio de la empresa (decide qué programas de fidelidad puede tener y canjear). */
async function orgMode(organizationId: string, db: Db = prisma): Promise<string> {
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { businessMode: true } })
  return org?.businessMode ?? "retail"
}

/** Solo los programas cuyo tipo aplica al negocio (si cambió de tipo, los que ya no aplican dejan de operar; se conservan sus datos). */
function programsForMode<T extends { kind: string }>(programs: T[], mode: string): T[] {
  return programs.filter((p) => LOYALTY_KIND_MODES[p.kind as LoyaltyKindKey]?.includes(mode as never))
}

const asIds = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [])
const isPackLike = (kind: string) => kind === "prepaid_pack" || kind === "membership"

/** Créditos que de verdad se pueden usar hoy (los de una membresía vencida ya no valen). */
export function usableCredits(kind: string, card: { credits: number; expiresAt: Date | null } | null | undefined, now = new Date()): number {
  if (!card) return 0
  if (kind === "membership" && (!card.expiresAt || card.expiresAt.getTime() <= now.getTime())) return 0
  return card.credits
}

/**
 * Qué pasa con una membresía al cobrar `bought` cuotas: renovar a tiempo suma el periodo al vencimiento actual; si ya
 * venció (o nunca existió) cuenta desde hoy. Los créditos sin usar pasan solo si el dueño lo permite y la membresía
 * seguía vigente. Lo comparten el cobro manual en caja y el cobro automático (cuando se active).
 */
export function membershipRenewal(
  program: { packUses: number | null; periodDays: number | null; rollover: boolean },
  card: { credits: number; expiresAt: Date | null; startedAt: Date | null },
  bought: number,
  now = new Date()
) {
  const periodDays = program.periodDays ?? 30
  const active = Boolean(card.expiresAt && card.expiresAt.getTime() > now.getTime())
  const base = active ? (card.expiresAt as Date) : now
  const expiresAt = new Date(base.getTime() + bought * periodDays * DAY_MS)
  const carried = active && program.rollover ? card.credits : 0
  const credits = carried + bought * (program.packUses ?? 0)
  return { active, expiresAt, credits, startedAt: active ? (card.startedAt ?? now) : now, delta: credits - (active ? card.credits : 0) }
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
      autoBilling: r.autoBilling,
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
  autoBilling?: unknown
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
  const mode = await orgMode(organizationId)
  if (!LOYALTY_KIND_MODES[kind].includes(mode as never)) throw new LoyaltyError(notForModeMessage(LOYALTY_KIND_NAMES[kind], mode, LOYALTY_KIND_MODES[kind]), 409, "kind")
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
  // Cobro automático: bloqueado por la plataforma salvo que el superAdmin lo haya desbloqueado para la empresa.
  let autoBilling = kind === "membership" ? (current?.autoBilling ?? false) : false
  if (kind === "membership" && input.autoBilling !== undefined) {
    const wanted = Boolean(input.autoBilling)
    if (wanted && !(await getAutoBillingState(organizationId)).unlocked) {
      throw new LoyaltyError("El cobro automático de membresías está bloqueado por la plataforma. Por ahora la cuota se cobra manualmente en caja.", 403, "autoBilling")
    }
    autoBilling = wanted
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
    autoBilling,
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
    /** Producto de la cuota: el POS lo agrega al ticket para dar de alta o renovar. */
    feeProductId: string | null
    cancelledAt: string | null
    autoRenew: boolean
    /** El cliente puede activar la renovación automática (desbloqueada, elegida por el negocio y con pasarela). */
    autoRenewAvailable: boolean
    /** Enlace de pago de la renovación si ya se pidió y sigue vigente. */
    pendingPaymentUrl: string | null
    billingStatus: string | null
    reminderDays: number
  }
}

/** Programas activos con lo que tiene un cliente (créditos, avance de visitas y vigencia de la membresía). */
export async function getCustomerLoyalty(organizationId: string, customerId: string): Promise<CustomerCredit[]> {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, organizationId }, select: { id: true } })
  if (!customer) throw new LoyaltyError("Cliente no encontrado", 404)
  const now = new Date()
  const [allPrograms, cards, mode] = await Promise.all([
    prisma.loyaltyProgram.findMany({ where: { organizationId, isActive: true }, orderBy: { createdAt: "asc" } }),
    prisma.loyaltyCard.findMany({ where: { organizationId, customerId } }),
    orgMode(organizationId),
  ])
  const programs = programsForMode(allPrograms, mode)
  const packIds = programs.filter((p) => p.packProductId).map((p) => p.packProductId as string)
  const byProgram = new Map(cards.map((c) => [c.programId, c]))
  // Cobro automático disponible para el cliente: desbloqueado por la plataforma y con pasarela de pagos registrada.
  const billingState = programs.some((p) => p.kind === "membership" && p.autoBilling) ? await getAutoBillingState(organizationId) : null
  const billingReady = Boolean(billingState?.unlocked && billingState.providerAvailable)
  const pendingIntents = cards.length
    ? await prisma.membershipPaymentIntent.findMany({ where: { organizationId, customerId, status: "pending", checkoutUrl: { not: null }, createdAt: { gte: new Date(now.getTime() - 3 * DAY_MS) } }, orderBy: { createdAt: "desc" } })
    : []
  const pending = new Map<string, string>()
  for (const intent of pendingIntents) if (!pending.has(intent.programId) && intent.checkoutUrl) pending.set(intent.programId, intent.checkoutUrl)
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
        feeProductId: p.packProductId,
        cancelledAt: card?.cancelledAt?.toISOString() ?? null,
        autoRenew: card?.autoRenew ?? false,
        autoRenewAvailable: billingReady && p.autoBilling,
        pendingPaymentUrl: pending.get(p.id) ?? null,
        billingStatus: card?.billingStatus ?? null,
        reminderDays: p.reminderDays,
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
  const programs = programsForMode(await prisma.loyaltyProgram.findMany({ where: { organizationId, isActive: true } }), await orgMode(organizationId))
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
  const programs = programsForMode(await tx.loyaltyProgram.findMany({ where: { organizationId, isActive: true } }), await orgMode(organizationId, tx))
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
      const renewal = membershipRenewal(program, card, bought, now)
      await tx.loyaltyCard.update({
        where: { id: card.id },
        data: { credits: renewal.credits, expiresAt: renewal.expiresAt, startedAt: renewal.startedAt, reminderSentAt: null, cancelledAt: null, ...(card.autoRenew ? { nextChargeAt: new Date(renewal.expiresAt.getTime() - program.reminderDays * DAY_MS), billingStatus: "active", lastBillingError: null } : {}) },
      })
      await tx.loyaltyMovement.create({ data: { organizationId, cardId: card.id, type: "purchase", delta: renewal.delta, saleId, note: `${renewal.active ? "Renovación" : "Alta"} · ${program.name}` } })
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

// ── Cobro automático de membresías (preparado, bloqueado por la plataforma) ───────────────────────────────────

export interface AutoBillingState {
  /** El superAdmin lo desbloqueó para esta empresa. */
  unlocked: boolean
  /** ¿La empresa registró su proveedor de pagos en línea (el mismo que cobra la cuota)? */
  providerAvailable: boolean
  message: string
}

export async function getAutoBillingState(organizationId: string): Promise<AutoBillingState> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { membershipAutoBilling: true } })
  const unlocked = Boolean(org?.membershipAutoBilling)
  const { billingProviderAvailable } = await import("./billing")
  const providerAvailable = await billingProviderAvailable(organizationId)
  return {
    unlocked,
    providerAvailable,
    message: !unlocked
      ? "El cobro automático de membresías está bloqueado por la plataforma. Por ahora la cuota se cobra manualmente en caja."
      : providerAvailable
        ? "El cobro automático está habilitado: se cobra por el mismo proveedor de pagos en línea que registraste en Ajustes → Pagos."
        : "El cobro automático está desbloqueado, pero necesita que registres tu proveedor de pagos en línea (Stripe o Mercado Pago) en Ajustes → Pagos. Mientras tanto la cuota se cobra en caja.",
  }
}

/** Solo el superAdmin (la ruta lo verifica). Al bloquear se apagan las preferencias de cobro automático de la empresa. */
export async function setAutoBillingUnlocked(organizationId: string, unlocked: boolean) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } })
  if (!org) throw new LoyaltyError("Empresa no encontrada", 404)
  await prisma.$transaction(async (tx) => {
    await tx.organization.update({ where: { id: organizationId }, data: { membershipAutoBilling: unlocked } })
    if (!unlocked) {
      await tx.loyaltyProgram.updateMany({ where: { organizationId }, data: { autoBilling: false } })
      await tx.loyaltyCard.updateMany({ where: { organizationId, autoRenew: true }, data: { autoRenew: false, nextChargeAt: null, billingStatus: "paused" } })
    }
  })
}

/**
 * El cliente activa o desactiva la renovación automática de su membresía. Activarla requiere que la plataforma haya
 * desbloqueado la función, que el negocio la haya elegido en esa membresía y que tenga su proveedor de pagos en línea
 * registrado. No se guarda tarjeta: cuando falten `reminderDays` para vencer se le envía el enlace de pago de la cuota.
 */
export async function setCardAutoRenew(organizationId: string, customerId: string, input: { programId: string; enabled: boolean }) {
  const state = await getAutoBillingState(organizationId)
  if (input.enabled && !state.unlocked) throw new LoyaltyError(state.message, 403)
  if (input.enabled && !state.providerAvailable) throw new LoyaltyError("El negocio aún no tiene pagos en línea configurados. Renueva tu cuota pagándola en el negocio.", 409)
  const program = await prisma.loyaltyProgram.findFirst({ where: { id: input.programId, organizationId, kind: "membership", isActive: true } })
  if (!program) throw new LoyaltyError("Membresía no encontrada", 404)
  if (input.enabled && !program.autoBilling) throw new LoyaltyError("Este negocio cobra esta membresía manualmente", 409)
  const card = await prisma.loyaltyCard.findUnique({ where: { customerId_programId: { customerId, programId: program.id } } })
  if (!card || card.organizationId !== organizationId) throw new LoyaltyError("Aún no tienes esta membresía", 404)
  if (!input.enabled) {
    await prisma.loyaltyCard.update({ where: { id: card.id }, data: { autoRenew: false, nextChargeAt: null, billingStatus: null, lastBillingError: null } })
    return
  }
  const now = new Date()
  if (!card.expiresAt || card.expiresAt.getTime() <= now.getTime()) throw new LoyaltyError("Tu membresía no está vigente: paga la cuota en el negocio para activarla", 409)
  const next = new Date(card.expiresAt.getTime() - program.reminderDays * DAY_MS)
  await prisma.loyaltyCard.update({ where: { id: card.id }, data: { autoRenew: true, nextChargeAt: next.getTime() < now.getTime() ? now : next, billingStatus: "active", lastBillingError: null } })
}

// ── Gestión manual de miembros ────────────────────────────────────────────────────────────────────────────────

export interface MemberRow {
  customerId: string
  customerName: string
  phone: string | null
  status: "active" | "expired" | "cancelled"
  startedAt: string | null
  expiresAt: string | null
  daysLeft: number | null
  credits: number
  usableCredits: number
  autoRenew: boolean
  billingStatus: string | null
}

/** Miembros de una membresía (más próximos a vencer primero): vigentes, vencidos y dados de baja. */
export async function listMembers(organizationId: string, programId: string): Promise<MemberRow[]> {
  const program = await prisma.loyaltyProgram.findFirst({ where: { id: programId, organizationId, kind: "membership" }, select: { id: true } })
  if (!program) throw new LoyaltyError("Membresía no encontrada", 404)
  const now = new Date()
  const cards = await prisma.loyaltyCard.findMany({
    where: { organizationId, programId, expiresAt: { not: null } },
    include: { customer: { select: { fullName: true, phone: true } } },
    orderBy: { expiresAt: "asc" },
    take: 300,
  })
  return cards
    .map((c) => {
      const active = Boolean(c.expiresAt && c.expiresAt.getTime() > now.getTime())
      return {
        customerId: c.customerId,
        customerName: c.customer.fullName,
        phone: c.customer.phone,
        status: (c.cancelledAt && !active ? "cancelled" : active ? "active" : "expired") as MemberRow["status"],
        startedAt: c.startedAt?.toISOString() ?? null,
        expiresAt: c.expiresAt?.toISOString() ?? null,
        daysLeft: active && c.expiresAt ? Math.max(0, Math.ceil((c.expiresAt.getTime() - now.getTime()) / DAY_MS)) : null,
        credits: c.credits,
        usableCredits: usableCredits("membership", c, now),
        autoRenew: c.autoRenew,
        billingStatus: c.billingStatus,
      }
    })
    .sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) || String(a.expiresAt).localeCompare(String(b.expiresAt)))
}

/**
 * Acciones manuales del negocio sobre un miembro (todas dejan un movimiento con su motivo):
 *  · cancel: da de baja la membresía hoy (conserva el historial; para volver a entrar basta cobrar la cuota).
 *  · extend: suma días de cortesía al vencimiento (o reactiva desde hoy si ya venció).
 *  · adjust: suma o resta créditos (corrección o cortesía).
 */
export async function manageMember(
  organizationId: string,
  programId: string,
  customerId: string,
  input: { action: "cancel" | "extend" | "adjust"; days?: unknown; credits?: unknown; note?: unknown }
) {
  const program = await prisma.loyaltyProgram.findFirst({ where: { id: programId, organizationId, kind: "membership" } })
  if (!program) throw new LoyaltyError("Membresía no encontrada", 404)
  const card = await prisma.loyaltyCard.findUnique({ where: { customerId_programId: { customerId, programId } } })
  if (!card || card.organizationId !== organizationId || !card.expiresAt) throw new LoyaltyError("Ese cliente no tiene esta membresía", 404)
  const note = String(input.note ?? "").trim().slice(0, 190)
  if (note.length < 3) throw new LoyaltyError("Escribe el motivo (queda en el historial)", 400, "note")
  const now = new Date()
  if (input.action === "cancel") {
    await prisma.$transaction([
      prisma.loyaltyCard.update({ where: { id: card.id }, data: { expiresAt: now, cancelledAt: now, autoRenew: false, nextChargeAt: null, billingStatus: null } }),
      prisma.loyaltyMovement.create({ data: { organizationId, cardId: card.id, type: "cancel", delta: 0, note } }),
    ])
    return
  }
  if (input.action === "extend") {
    const days = intIn(input.days, "Los días de cortesía", 1, 366, "days")
    const active = card.expiresAt.getTime() > now.getTime()
    const base = active ? card.expiresAt : now
    await prisma.$transaction([
      prisma.loyaltyCard.update({ where: { id: card.id }, data: { expiresAt: new Date(base.getTime() + days * DAY_MS), cancelledAt: null, reminderSentAt: null, ...(active ? {} : { startedAt: now }) } }),
      prisma.loyaltyMovement.create({ data: { organizationId, cardId: card.id, type: "adjust", delta: 0, note: `+${days} día(s): ${note}` } }),
    ])
    return
  }
  if (input.action === "adjust") {
    const delta = Number(input.credits)
    if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100) throw new LoyaltyError("Los créditos a sumar o restar deben ser un entero entre -100 y 100 (distinto de 0)", 400, "credits")
    if (card.credits + delta < 0) throw new LoyaltyError("No se pueden dejar créditos negativos", 409, "credits")
    await prisma.$transaction([
      prisma.loyaltyCard.update({ where: { id: card.id }, data: { credits: { increment: delta } } }),
      prisma.loyaltyMovement.create({ data: { organizationId, cardId: card.id, type: "adjust", delta, note } }),
    ])
    return
  }
  throw new LoyaltyError("Acción no válida", 400)
}
