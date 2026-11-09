import { prisma } from "@/lib/db"
import { notifyCustomer } from "@/lib/notifications/customer-channels"
import { notifyStaff } from "@/lib/notifications/staff"
import { createCheckout, getPaymentConfig } from "@/lib/payments/server"
import { paymentMatches } from "@/lib/payments/verification"
import { createSale } from "@/lib/pos/server"
import type { PosSalePayload } from "@/types/pos"

// Cobro automático de membresías (opcional).
//
// El proveedor es el MISMO de pagos en línea que la empresa ya registró en Ajustes → Pagos (Stripe o Mercado Pago); no se
// pide nada más. Funciona por enlace de pago, sin guardar tarjetas:
//  1. El superAdmin desbloquea la función para la empresa (`Organization.membershipAutoBilling`, permiso `loyalty.autobilling`),
//     el dueño la elige en su membresía (`LoyaltyProgram.autoBilling`) y el cliente activa la renovación automática desde su portal.
//  2. Cuando falta `reminderDays` para vencer, el proceso diario (`runAutoRenewals`) pide a la pasarela un enlace de pago por la cuota
//     (un `MembershipPaymentIntent` por periodo) y avisa al cliente; en su portal ve el botón «Pagar renovación».
//  3. Al confirmarse el pago (webhook de Stripe / Mercado Pago con referencia `membership:<intent>`) se registra una venta con la cuota
//     (pago con tarjeta, sin caja) y el motor de fidelidad renueva el periodo igual que si la cuota se cobrara en caja.
// Si el enlace no se paga en 3 días, el intento caduca, se avisa al cliente y al negocio y la cuota se puede cobrar en caja como siempre.

const DAY_MS = 86_400_000
/** Días que un enlace de pago sin pagar sigue vigente antes de caducar. */
const LINK_TTL_DAYS = 3
/** Si el periodo ya venció hace más de esto, no se insiste con cobros automáticos. */
const GIVE_UP_AFTER_EXPIRY_DAYS = 7

/** ¿La empresa tiene una pasarela de pagos en línea lista para cobrar? */
export async function billingProviderAvailable(organizationId: string): Promise<boolean> {
  const config = await getPaymentConfig(organizationId)
  return (config.provider === "stripe" && Boolean(config.stripe.secretKey)) || (config.provider === "mercadopago" && Boolean(config.mercadopago.accessToken))
}

async function feeFor(organizationId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId, isActive: true },
    select: { id: true, name: true, taxRate: true, variants: { where: { isActive: true }, orderBy: { createdAt: "asc" }, take: 1, select: { id: true, price: true } } },
  })
  const variant = product?.variants[0]
  if (!product || !variant) return null
  const price = Math.round(Number(variant.price) * 100) / 100
  const taxRate = Number(product.taxRate)
  const tax = Math.round(price * taxRate * 100) / 100
  return { productId: product.id, variantId: variant.id, name: product.name, price, taxRate, tax, total: Math.round((price + tax) * 100) / 100 }
}

export interface AutoRenewalSummary {
  skipped: "locked" | "no_provider" | null
  due: number
  requested: number
  expired: number
  failed: number
}

const periodKeyOf = (cardId: string, expiresAt: Date | null) => `${cardId}:${expiresAt ? expiresAt.toISOString() : "none"}`

/** Pide el enlace de pago de la cuota de un periodo y avisa al cliente. Idempotente por periodo. */
export async function requestMembershipPayment(cardId: string, now = new Date()) {
  const card = await prisma.loyaltyCard.findUnique({ where: { id: cardId }, include: { program: true } })
  if (!card || card.program.kind !== "membership" || !card.program.packProductId) throw new Error("Membresía no encontrada")
  const organizationId = card.organizationId
  const key = periodKeyOf(card.id, card.expiresAt)
  const existing = await prisma.membershipPaymentIntent.findUnique({ where: { periodKey: key } })
  if (existing) return { intent: existing, created: false }

  const [fee, org, customer, config] = await Promise.all([
    feeFor(organizationId, card.program.packProductId),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { currency: true } }),
    prisma.customer.findFirst({ where: { id: card.customerId, organizationId }, select: { email: true } }),
    getPaymentConfig(organizationId),
  ])
  if (!fee || !org) throw new Error("El producto de la cuota ya no está disponible")
  if (config.provider === "none") throw new Error("La empresa aún no configuró pagos en línea")
  const intent = await prisma.membershipPaymentIntent.create({
    data: { organizationId, customerId: card.customerId, programId: card.programId, cardId: card.id, amount: fee.total, currency: org.currency, provider: config.provider, periodKey: key },
  })
  try {
    const checkout = await createCheckout(organizationId, {
      orderId: `membership:${intent.id}`,
      orderNumber: 0,
      amount: fee.total,
      currency: org.currency,
      customerEmail: customer?.email ?? null,
      items: [{ name: `${card.program.name} · cuota`, quantity: 1, unitPrice: fee.total }],
    })
    const updated = await prisma.membershipPaymentIntent.update({ where: { id: intent.id }, data: { externalId: checkout.externalId, checkoutUrl: checkout.url } })
    await notifyCustomer({
      organizationId,
      customerId: card.customerId,
      kind: "membership_payment",
      title: "Renueva tu membresía",
      body: `${card.program.name}: tu cuota de $${fee.total.toFixed(2)} está lista para pagar en línea. Entra a tus puntos y pulsa «Pagar renovación».`,
      link: "/portal/loyalty",
    })
    return { intent: updated, created: true }
  } catch (err) {
    await prisma.membershipPaymentIntent.update({ where: { id: intent.id }, data: { status: "failed" } })
    throw err
  }
}

/**
 * Proceso diario: pide el enlace de pago a quien ya toca renovar (renovación automática activa, con `reminderDays` por
 * delante del vencimiento), y caduca los enlaces que nadie pagó. Sin desbloqueo de la plataforma o sin pasarela no hace nada.
 * `organizationId` limita a una empresa.
 */
export async function runAutoRenewals(organizationId?: string, now = new Date()): Promise<AutoRenewalSummary> {
  const orgs = await prisma.organization.findMany({ where: { membershipAutoBilling: true, ...(organizationId ? { id: organizationId } : {}) }, select: { id: true } })
  if (!orgs.length) return { skipped: "locked", due: 0, requested: 0, expired: 0, failed: 0 }
  const summary: AutoRenewalSummary = { skipped: null, due: 0, requested: 0, expired: 0, failed: 0 }
  let anyProvider = false
  for (const org of orgs) {
    if (!(await billingProviderAvailable(org.id))) continue
    anyProvider = true

    // Enlaces sin pagar que ya caducaron
    const stale = await prisma.membershipPaymentIntent.findMany({ where: { organizationId: org.id, status: "pending", createdAt: { lt: new Date(now.getTime() - LINK_TTL_DAYS * DAY_MS) } }, take: 200 })
    for (const intent of stale) {
      const closed = await prisma.membershipPaymentIntent.updateMany({ where: { id: intent.id, status: "pending" }, data: { status: "expired" } })
      if (!closed.count) continue
      summary.expired += 1
      await prisma.loyaltyCard.updateMany({ where: { id: intent.cardId, autoRenew: true }, data: { billingStatus: "failed", lastBillingError: "El enlace de pago caducó sin pagarse" } })
      await notifyCustomer({ organizationId: org.id, customerId: intent.customerId, kind: "membership_payment_expired", title: "Tu pago de membresía caducó", body: "No recibimos el pago de tu cuota. Puedes pagarla en el negocio para renovar.", link: "/portal/loyalty" })
      await notifyStaff(org.id, "loyalty.manage", { kind: "membership_payment_expired", title: "Cobro de membresía sin pagar", body: "Un cliente no pagó el enlace de renovación de su membresía.", link: "/admin/loyalty-programs", severity: "warning" }).catch(() => undefined)
    }

    const due = await prisma.loyaltyCard.findMany({
      where: {
        organizationId: org.id, autoRenew: true, billingStatus: { in: ["active", "awaiting_payment"] }, nextChargeAt: { lte: now }, expiresAt: { not: null }, cancelledAt: null,
        program: { kind: "membership", isActive: true, autoBilling: true },
      },
      take: 200,
    })
    summary.due += due.length
    for (const card of due) {
      const lapsed = card.expiresAt && now.getTime() - card.expiresAt.getTime() > GIVE_UP_AFTER_EXPIRY_DAYS * DAY_MS
      if (lapsed) {
        await prisma.loyaltyCard.update({ where: { id: card.id }, data: { autoRenew: false, nextChargeAt: null, billingStatus: "failed", lastBillingError: "La membresía venció sin renovarse" } })
        continue
      }
      if (await prisma.membershipPaymentIntent.findUnique({ where: { periodKey: periodKeyOf(card.id, card.expiresAt) } })) continue
      try {
        await requestMembershipPayment(card.id, now)
        await prisma.loyaltyCard.update({ where: { id: card.id }, data: { billingStatus: "awaiting_payment", lastBillingError: null } })
        summary.requested += 1
      } catch (err) {
        summary.failed += 1
        await prisma.loyaltyCard.update({ where: { id: card.id }, data: { billingStatus: "failed", lastBillingError: (err instanceof Error ? err.message : "No se pudo pedir el pago").slice(0, 190) } })
      }
    }
  }
  if (!anyProvider) summary.skipped = "no_provider"
  return summary
}

/**
 * Confirmación del pago por la pasarela (webhook). Valida monto y proveedor, reclama el intento, registra la venta de la
 * cuota (el motor de fidelidad renueva el periodo) y avisa. Si la venta no se pudo registrar queda `paid_review` para conciliar.
 */
export async function markMembershipPaymentPaid(
  organizationId: string,
  reference: string,
  provider: "stripe" | "mercadopago",
  externalId: string | undefined,
  amount: unknown,
  currency: unknown
): Promise<{ ok: boolean }> {
  if (!reference.startsWith("membership:")) return { ok: false }
  const id = reference.slice("membership:".length)
  const intent = await prisma.membershipPaymentIntent.findFirst({ where: { id, organizationId, provider } })
  if (!intent || !paymentMatches(Number(intent.amount), intent.currency, amount, currency)) return { ok: false }
  if (provider === "stripe" && intent.externalId && externalId !== intent.externalId) return { ok: false }
  if (intent.status === "paid" || intent.status === "paid_review") return { ok: true }
  if (intent.status !== "pending" && intent.status !== "expired") return { ok: false }
  const claimed = await prisma.membershipPaymentIntent.updateMany({ where: { id, status: { in: ["pending", "expired"] } }, data: { status: "processing" } })
  if (!claimed.count) return { ok: true }

  const card = await prisma.loyaltyCard.findUnique({ where: { id: intent.cardId }, include: { program: true } })
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { ownerId: true } })
  const location = await prisma.location.findFirst({ where: { organizationId, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } })
  const fee = card?.program.packProductId ? await feeFor(organizationId, card.program.packProductId) : null
  try {
    if (!card || !org || !location || !fee) throw new Error("Falta información para registrar la venta de la cuota")
    const subtotal = fee.price
    const payload: PosSalePayload = {
      items: [{
        productId: fee.productId, variantId: fee.variantId, productType: "standard", productName: fee.name, variantName: null, quantity: 1, unitId: null,
        unitPrice: fee.price, totalPrice: subtotal, discount: 0, taxRate: fee.taxRate, lineTotal: subtotal, trackInventory: false, extraPrice: 0,
      }],
      customerId: intent.customerId, subtotal, discount: 0, tax: fee.tax, total: fee.total, changeGiven: 0,
      pointsEarned: 0, pointsRedeemed: 0, pointsRedeemedValue: 0,
      payments: [{ method: "card", amount: fee.total, reference: `${provider}:${externalId ?? intent.id}` }],
      discounts: [], notes: `Cuota de membresía pagada en línea (${provider})`,
    }
    const sale = await createSale(organizationId, location.id, payload, { userId: org.ownerId, employeeId: null })
    await prisma.membershipPaymentIntent.update({ where: { id }, data: { status: "paid", paidAt: new Date(), saleId: sale.id } })
    await notifyCustomer({ organizationId, customerId: intent.customerId, kind: "membership_renewed", title: "Membresía renovada", body: `Recibimos tu pago de $${Number(intent.amount).toFixed(2)}. Ya tienes tus servicios del nuevo periodo.`, link: "/portal/loyalty" })
    await notifyStaff(organizationId, "loyalty.manage", { kind: "membership_renewed", title: "Membresía renovada en línea", body: `$${Number(intent.amount).toFixed(2)} cobrados por ${provider === "stripe" ? "Stripe" : "Mercado Pago"}.`, link: "/admin/loyalty-programs", severity: "success" }).catch(() => undefined)
  } catch (err) {
    console.error("[membership-payment]", err)
    await prisma.membershipPaymentIntent.update({ where: { id }, data: { status: "paid_review", paidAt: new Date() } })
    await notifyStaff(organizationId, "loyalty.manage", { kind: "membership_review", title: "Pago de membresía por conciliar", body: "Se recibió un pago en línea pero la cuota no se pudo registrar sola: revísalo en Miembros.", link: "/admin/loyalty-programs", severity: "warning" }).catch(() => undefined)
  }
  return { ok: true }
}
