import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { redemptionAmount } from "@/lib/loyalty/redeem"
import { zonedParts } from "@/lib/schedule"
import { warrantyLegendText, warrantyPresetByKey } from "./presets"

// Garantías de servicio. Existen solo si el dueño crea y deja activa una regla; entonces el ticket de los servicios
// que cubre lleva la leyenda y el cliente puede canjear la garantía presentando el ticket (en caja) o pidiéndola desde
// el portal. Se canjea como un descuento en una venta nueva y queda registrada una sola vez por ticket y regla.

export class WarrantyError extends Error {
  status: number
  field?: string
  constructor(message: string, status = 400, field?: string) {
    super(message)
    this.status = status
    this.field = field
  }
}

type Db = Prisma.TransactionClient | typeof prisma

const asIds = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [])

export interface WarrantyRuleDto {
  id: string
  presetKey: string | null
  name: string
  isActive: boolean
  appliesToProductIds: string[]
  appliesToProductNames: string[]
  coversProductIds: string[]
  coversProductNames: string[]
  windowHours: number
  sameDayOnly: boolean
  discountPercent: number
  legend: string | null
  /** Texto que verá el cliente en el ticket (la leyenda propia o la armada con las condiciones). */
  legendPreview: string
  used: number
  requested: number
}

export async function listWarrantyRules(organizationId: string): Promise<WarrantyRuleDto[]> {
  const rules = await prisma.warrantyRule.findMany({ where: { organizationId }, orderBy: [{ isActive: "desc" }, { createdAt: "asc" }] })
  const ids = [...new Set(rules.flatMap((r) => [...asIds(r.appliesToProductIds), ...asIds(r.coversProductIds)]))]
  const [products, counts] = await Promise.all([
    ids.length ? prisma.product.findMany({ where: { organizationId, id: { in: ids } }, select: { id: true, name: true } }) : [],
    prisma.warrantyClaim.groupBy({ by: ["ruleId", "status"], where: { organizationId }, _count: { _all: true } }),
  ])
  const name = new Map(products.map((p) => [p.id, p.name]))
  return rules.map((r) => {
    const applies = asIds(r.appliesToProductIds)
    const covers = asIds(r.coversProductIds)
    const count = (status: string) => counts.find((c) => c.ruleId === r.id && c.status === status)?._count._all ?? 0
    return {
      id: r.id,
      presetKey: r.presetKey,
      name: r.name,
      isActive: r.isActive,
      appliesToProductIds: applies,
      appliesToProductNames: applies.map((id) => name.get(id) ?? "Producto eliminado"),
      coversProductIds: covers,
      coversProductNames: covers.map((id) => name.get(id) ?? "Producto eliminado"),
      windowHours: r.windowHours,
      sameDayOnly: r.sameDayOnly,
      discountPercent: r.discountPercent,
      legend: r.legend,
      legendPreview: warrantyLegendText(r),
      used: count("used"),
      requested: count("requested"),
    }
  })
}

export interface WarrantyRuleInput {
  presetKey?: unknown
  name?: unknown
  isActive?: unknown
  appliesToProductIds?: unknown
  coversProductIds?: unknown
  windowHours?: unknown
  sameDayOnly?: unknown
  discountPercent?: unknown
  legend?: unknown
}

const intIn = (v: unknown, label: string, min: number, max: number, field: string) => {
  const n = Number(v)
  if (!Number.isInteger(n) || n < min || n > max) throw new WarrantyError(`${label}: ingresa un número entero entre ${min} y ${max}`, 400, field)
  return n
}

export async function saveWarrantyRule(organizationId: string, input: WarrantyRuleInput, id?: string) {
  const current = id ? await prisma.warrantyRule.findFirst({ where: { id, organizationId } }) : null
  if (id && !current) throw new WarrantyError("Garantía no encontrada", 404)
  const name = String(input.name ?? current?.name ?? "").trim()
  if (name.length < 2 || name.length > 80) throw new WarrantyError("El nombre debe tener entre 2 y 80 caracteres", 400, "name")
  const appliesToProductIds = [...new Set(asIds(input.appliesToProductIds ?? current?.appliesToProductIds))]
  const coversProductIds = [...new Set(asIds(input.coversProductIds ?? current?.coversProductIds))]
  const all = [...new Set([...appliesToProductIds, ...coversProductIds])]
  if (all.length && (await prisma.product.count({ where: { organizationId, id: { in: all } } })) !== all.length) {
    throw new WarrantyError("Algún servicio no pertenece a la empresa activa", 400, "appliesToProductIds")
  }
  const legend = input.legend !== undefined ? String(input.legend ?? "").trim() : (current?.legend ?? "")
  if (legend.length > 1000) throw new WarrantyError("La leyenda del ticket es demasiado larga (máximo 1000 caracteres)", 400, "legend")
  const data = {
    presetKey: warrantyPresetByKey(typeof input.presetKey === "string" ? input.presetKey : current?.presetKey)?.key ?? null,
    name,
    isActive: input.isActive !== undefined ? Boolean(input.isActive) : (current?.isActive ?? true),
    appliesToProductIds,
    coversProductIds,
    windowHours: intIn(input.windowHours ?? current?.windowHours ?? 24, "Las horas de vigencia", 1, 720, "windowHours"),
    sameDayOnly: input.sameDayOnly !== undefined ? Boolean(input.sameDayOnly) : (current?.sameDayOnly ?? false),
    discountPercent: intIn(input.discountPercent ?? current?.discountPercent ?? 100, "El porcentaje que cubre la garantía", 1, 100, "discountPercent"),
    legend: legend || null,
  }
  if (current) return prisma.warrantyRule.update({ where: { id: current.id }, data })
  return prisma.warrantyRule.create({ data: { organizationId, ...data } })
}

export interface WarrantyOffer {
  ruleId: string
  name: string
  discountPercent: number
  /** Servicios que se pueden repetir con esta garantía. */
  coversProductIds: string[]
  expiresAt: string
  legend: string
  /** requested = el cliente ya la pidió desde el portal; used = ya se canjeó. */
  claimStatus: "none" | "requested" | "used" | "rejected"
}

export interface WarrantySaleInfo {
  saleId: string
  saleNumber: string
  createdAt: string
  customerId: string | null
  customerName: string | null
  offers: WarrantyOffer[]
}

const sameDay = (a: Date, b: Date, tz: string) => {
  const x = zonedParts(a, tz)
  const y = zonedParts(b, tz)
  return x.year === y.year && x.month === y.month && x.day === y.day
}

/** ¿Qué garantías cubren esta venta hoy? (ventana de horas, mismo día, servicios cubiertos y no usada). */
export async function evaluateWarranty(organizationId: string, where: { saleNumber?: string; saleId?: string; locationId?: string | null }, now = new Date(), db: Db = prisma): Promise<WarrantySaleInfo | null> {
  let number: bigint | null = null
  if (where.saleNumber) {
    // El número que se ve en el ticket es el consecutivo de la sucursal («#123»).
    const typed = where.saleNumber.trim().replace(/^#/, "")
    if (!/^\d{1,18}$/.test(typed)) return null
    number = BigInt(typed)
  }
  const sale = await db.sale.findFirst({
    where: { organizationId, status: "completed", ...(where.saleId ? { id: where.saleId } : {}), ...(number !== null ? { locationSaleNumber: number } : {}), ...(where.locationId ? { locationId: where.locationId } : {}) },
    select: { id: true, saleNumber: true, locationSaleNumber: true, createdAt: true, customerId: true, customer: { select: { fullName: true } }, location: { select: { timezone: true } }, items: { select: { productId: true } } },
  })
  if (!sale) return null
  const rules = await db.warrantyRule.findMany({ where: { organizationId, isActive: true } })
  if (!rules.length) return { saleId: sale.id, saleNumber: `#${Number(sale.locationSaleNumber ?? sale.saleNumber)}`, createdAt: sale.createdAt.toISOString(), customerId: sale.customerId, customerName: sale.customer?.fullName ?? null, offers: [] }
  const productIds = [...new Set(sale.items.map((i) => i.productId).filter((x): x is string => Boolean(x)))]
  const services = await db.product.findMany({ where: { organizationId, id: { in: productIds }, trackInventory: false }, select: { id: true } })
  const serviceIds = new Set(services.map((p) => p.id))
  const claims = await db.warrantyClaim.findMany({ where: { organizationId, saleId: sale.id } })
  const tz = sale.location?.timezone || "America/Mexico_City"
  const offers: WarrantyOffer[] = []
  for (const rule of rules) {
    const applies = asIds(rule.appliesToProductIds)
    const covered = (applies.length ? productIds.filter((id) => applies.includes(id)) : [...serviceIds]).filter((id) => serviceIds.has(id))
    if (!covered.length) continue
    const expires = new Date(sale.createdAt.getTime() + rule.windowHours * 3_600_000)
    if (now.getTime() > expires.getTime()) continue
    if (rule.sameDayOnly && !sameDay(sale.createdAt, now, tz)) continue
    const claim = claims.find((c) => c.ruleId === rule.id)
    if (claim && (claim.status === "used" || claim.status === "rejected")) continue
    const covers = asIds(rule.coversProductIds)
    offers.push({
      ruleId: rule.id,
      name: rule.name,
      discountPercent: rule.discountPercent,
      coversProductIds: covers.length ? covers : covered,
      expiresAt: expires.toISOString(),
      legend: warrantyLegendText(rule),
      claimStatus: claim ? (claim.status as WarrantyOffer["claimStatus"]) : "none",
    })
  }
  return { saleId: sale.id, saleNumber: `#${Number(sale.locationSaleNumber ?? sale.saleNumber)}`, createdAt: sale.createdAt.toISOString(), customerId: sale.customerId, customerName: sale.customer?.fullName ?? null, offers }
}

interface SaleLine {
  productId: string
  quantity: number
  unitPrice: number
}

/** Antes de cobrar: cada garantía canjeada debe estar vigente, ser de otro ticket y traer el monto exacto del servidor. */
export async function validateWarrantyRedemptions(
  organizationId: string,
  input: { items: SaleLine[]; discounts: { warrantyRuleId?: string; warrantySaleId?: string; amount: number }[] }
): Promise<{ ruleId: string; saleId: string; customerId: string | null }[]> {
  const redeems = input.discounts.filter((d) => d.warrantyRuleId || d.warrantySaleId)
  if (!redeems.length) return []
  const lines = input.items.flatMap((i) => Array.from({ length: Math.max(1, Math.floor(i.quantity)) }, () => ({ productId: i.productId, unitPrice: i.unitPrice })))
  const out: { ruleId: string; saleId: string; customerId: string | null }[] = []
  for (const d of redeems) {
    if (!d.warrantyRuleId || !d.warrantySaleId) throw new WarrantyError("Garantía incompleta", 400)
    if (out.some((o) => o.saleId === d.warrantySaleId && o.ruleId === d.warrantyRuleId)) throw new WarrantyError("Cada garantía se canjea una sola vez por venta", 400)
    const info = await evaluateWarranty(organizationId, { saleId: d.warrantySaleId })
    const offer = info?.offers.find((o) => o.ruleId === d.warrantyRuleId)
    if (!info || !offer) throw new WarrantyError("Esa garantía ya no está vigente para este ticket", 409)
    const rule = await prisma.warrantyRule.findFirst({ where: { id: d.warrantyRuleId, organizationId, isActive: true }, select: { discountPercent: true } })
    const expected = redemptionAmount(lines, offer.coversProductIds, rule?.discountPercent ?? offer.discountPercent)
    if (expected <= 0) throw new WarrantyError(`En este ticket no hay ningún servicio que cubra la garantía «${offer.name}»`, 409)
    if (Math.abs(d.amount - expected) > 0.01) throw new WarrantyError("El descuento de la garantía no coincide con el cálculo del servidor", 400)
    out.push({ ruleId: offer.ruleId, saleId: info.saleId, customerId: info.customerId })
  }
  return out
}

/** Dentro de la transacción de la venta: marca la garantía como usada (una vez por ticket y regla). */
export async function applyWarrantyToSale(tx: Db, args: { organizationId: string; usedSaleId: string; redemptions: { ruleId: string; saleId: string; customerId: string | null }[] }) {
  const now = new Date()
  for (const r of args.redemptions) {
    if (r.saleId === args.usedSaleId) throw new WarrantyError("Una venta no puede usar su propia garantía", 400)
    const existing = await tx.warrantyClaim.findUnique({ where: { saleId_ruleId: { saleId: r.saleId, ruleId: r.ruleId } } })
    if (existing && (existing.status === "used" || existing.status === "rejected")) throw new WarrantyError("Esa garantía ya se usó", 409)
    if (existing) {
      const done = await tx.warrantyClaim.updateMany({ where: { id: existing.id, status: "requested" }, data: { status: "used", usedSaleId: args.usedSaleId, resolvedAt: now } })
      if (!done.count) throw new WarrantyError("Esa garantía ya se usó", 409)
    } else {
      await tx.warrantyClaim.create({ data: { organizationId: args.organizationId, ruleId: r.ruleId, saleId: r.saleId, customerId: r.customerId, status: "used", usedSaleId: args.usedSaleId, resolvedAt: now } })
    }
  }
}

/** Leyendas de garantía para el ticket de una venta (solo de las reglas activas que cubren sus servicios). */
export async function warrantyTicketLegends(organizationId: string, items: { productId: string }[]): Promise<string[]> {
  const rules = await prisma.warrantyRule.findMany({ where: { organizationId, isActive: true } })
  if (!rules.length || !items.length) return []
  const productIds = [...new Set(items.map((i) => i.productId))]
  const services = await prisma.product.findMany({ where: { organizationId, id: { in: productIds }, trackInventory: false }, select: { id: true } })
  const serviceIds = new Set(services.map((s) => s.id))
  const legends: string[] = []
  for (const rule of rules) {
    const applies = asIds(rule.appliesToProductIds)
    const covered = (applies.length ? productIds.filter((id) => applies.includes(id)) : [...serviceIds]).filter((id) => serviceIds.has(id))
    if (covered.length) legends.push(warrantyLegendText(rule))
  }
  return legends
}

/** Garantías vigentes de un cliente a partir de sus ventas recientes (para el portal). */
export async function listCustomerWarranties(organizationId: string, customerId: string, now = new Date()) {
  const since = new Date(now.getTime() - 30 * 86_400_000)
  const sales = await prisma.sale.findMany({ where: { organizationId, customerId, status: "completed", createdAt: { gte: since } }, select: { id: true }, orderBy: { createdAt: "desc" }, take: 30 })
  const out: (WarrantySaleInfo & { offers: WarrantyOffer[] })[] = []
  for (const s of sales) {
    const info = await evaluateWarranty(organizationId, { saleId: s.id }, now)
    if (info && info.offers.length) out.push(info)
  }
  return out
}

/** El cliente pide su garantía desde el portal: queda registrada para que en caja se canjee con el ticket. */
export async function requestWarranty(organizationId: string, customerId: string, input: { saleId: string; ruleId: string; reason?: string | null }) {
  const info = await evaluateWarranty(organizationId, { saleId: input.saleId })
  if (!info || info.customerId !== customerId) throw new WarrantyError("Ticket no encontrado", 404)
  const offer = info.offers.find((o) => o.ruleId === input.ruleId)
  if (!offer) throw new WarrantyError("Esa garantía ya no está vigente para este ticket", 409)
  if (offer.claimStatus === "requested") throw new WarrantyError("Ya pediste esta garantía: preséntate en el negocio con tu ticket", 409)
  const claim = await prisma.warrantyClaim.create({
    data: { organizationId, ruleId: input.ruleId, saleId: input.saleId, customerId, status: "requested", reason: input.reason?.trim().slice(0, 190) || null },
  })
  return { id: claim.id, expiresAt: offer.expiresAt }
}
