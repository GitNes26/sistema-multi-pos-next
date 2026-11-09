/* eslint-disable @typescript-eslint/no-explicit-any -- script de verificación */
// Verifica en la base aislada los programas de fidelidad: tarjeta de visitas (gana crédito cada N ventas),
// paquete prepagado (la compra da créditos), canje validado por el servidor y aislamiento. Limpia lo que crea.
import fs from "node:fs"
import path from "node:path"

Object.assign(process.env, JSON.parse(fs.readFileSync(path.resolve(".env.test-minimal.local"), "utf8")))
const { assertTestEnvironment } = await import("../test-safety.mjs")
assertTestEnvironment(process.env as Record<string, string>)
const { prisma } = await import("../../src/lib/db")
const loyalty = await import("../../src/lib/loyalty/server")
const { createSale } = await import("../../src/lib/pos/server")
const { Prisma } = await import("@prisma/client")

const orgs = JSON.parse(fs.readFileSync(".loadtest/orgs.json", "utf8"))
const orgId = orgs[5].orgId as string
const user = await prisma.user.findFirstOrThrow({ select: { id: true } })
const location = await prisma.location.findFirstOrThrow({ where: { organizationId: orgId }, orderBy: { createdAt: "asc" } })
const customer = await prisma.customer.findFirstOrThrow({ where: { organizationId: orgId } })

let failures = 0
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "OK  " : "FALLA"} ${name} ${extra}`)
  if (!ok) failures += 1
}
const expectErr = async (name: string, fn: () => Promise<unknown>, contains: string) => {
  try {
    await fn()
    check(name, false, "no lanzó error")
  } catch (e: any) {
    check(name, String(e.message).toLowerCase().includes(contains.toLowerCase()), `(${e?.message})`)
  }
}

const modeBefore = (await prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { businessMode: true } })).businessMode
await prisma.organization.update({ where: { id: orgId }, data: { businessMode: "services" } })
const created = { products: [] as string[], programs: [] as string[], sales: [] as string[] }
const startedAt = new Date()
const mkProduct = async (name: string, price: number) => {
  const p = await prisma.product.create({ data: { organizationId: orgId, name, trackInventory: false, taxRate: 0, variants: { create: { organizationId: orgId, name: "Default", price } } }, include: { variants: true } })
  created.products.push(p.id)
  return { id: p.id, variantId: p.variants[0].id, price, name }
}
const line = (p: { id: string; variantId: string; price: number; name: string }, qty = 1) => ({
  productId: p.id, variantId: p.variantId, productType: "standard" as const, productName: p.name, variantName: null, quantity: qty, unitId: null,
  unitPrice: p.price, totalPrice: p.price * qty, discount: 0, taxRate: 0, lineTotal: p.price * qty, trackInventory: false, extraPrice: 0,
})
const sell = async (items: ReturnType<typeof line>[], opts: { redeem?: { programId: string; amount: number }; customer?: boolean } = {}) => {
  const subtotal = items.reduce((a, i) => a + i.totalPrice, 0)
  const discount = opts.redeem?.amount ?? 0
  // El descuento se reparte entre las líneas en proporción a su importe (como el POS)
  const withDiscount = items.map((i) => ({ ...i, discount: Math.round((i.totalPrice / subtotal) * discount * 100) / 100 }))
  withDiscount.forEach((i) => (i.lineTotal = Math.round((i.totalPrice - i.discount) * 100) / 100))
  const total = Math.max(0, subtotal - discount)
  const sale = await createSale(orgId, location.id, {
    items: withDiscount as any, customerId: opts.customer === false ? undefined : customer.id, subtotal, discount, tax: 0, total, changeGiven: 0,
    pointsEarned: 0, pointsRedeemed: 0, pointsRedeemedValue: 0, payments: total > 0 ? [{ method: "cash", amount: total }] : [],
    discounts: opts.redeem ? [{ label: "Recompensa", amount: discount, loyaltyProgramId: opts.redeem.programId }] : [],
  } as any, { userId: user.id, employeeId: null })
  created.sales.push(sale.id)
  return sale
}
const card = (programId: string) => prisma.loyaltyCard.findUnique({ where: { customerId_programId: { customerId: customer.id, programId } } })

try {
  // Restos de una corrida interrumpida
  const oldProducts = await prisma.product.findMany({ where: { organizationId: orgId, name: { startsWith: "zz Fid" } }, select: { id: true } })
  const oldIds = oldProducts.map((p) => p.id)
  const oldSales = await prisma.sale.findMany({ where: { organizationId: orgId, items: { some: { productId: { in: oldIds } } } }, select: { id: true } })
  for (const s of oldSales) {
    await prisma.saleDiscount.deleteMany({ where: { saleId: s.id } })
    await prisma.salePayment.deleteMany({ where: { saleId: s.id } })
    await prisma.saleItem.deleteMany({ where: { saleId: s.id } })
  }
  await prisma.loyaltyMovement.deleteMany({ where: { saleId: { in: oldSales.map((s) => s.id) } } })
  await prisma.sale.deleteMany({ where: { id: { in: oldSales.map((s) => s.id) } } })
  const oldPrograms = await prisma.loyaltyProgram.findMany({ where: { organizationId: orgId, name: { startsWith: "zz Fid" } }, select: { id: true } })
  await prisma.loyaltyMovement.deleteMany({ where: { card: { programId: { in: oldPrograms.map((p) => p.id) } } } })
  await prisma.loyaltyCard.deleteMany({ where: { programId: { in: oldPrograms.map((p) => p.id) } } })
  await prisma.loyaltyProgram.deleteMany({ where: { id: { in: oldPrograms.map((p) => p.id) } } })
  await prisma.productVariant.deleteMany({ where: { productId: { in: oldIds } } })
  await prisma.product.deleteMany({ where: { id: { in: oldIds } } })

  const cut = await mkProduct("zz Fid Corte", 100)
  const pack = await mkProduct("zz Fid Paquete 3", 270)
  const other = await mkProduct("zz Fid Refresco", 30)

  // Configuración
  await expectErr("una tarjeta de visitas exige 2 o más visitas", () => loyalty.saveLoyaltyProgram(orgId, { kind: "visit_card", name: "zz Fid x", visitsRequired: 1 }), "visitas")
  await expectErr("un paquete exige el producto que se vende", () => loyalty.saveLoyaltyProgram(orgId, { kind: "prepaid_pack", name: "zz Fid x", packUses: 3 }), "producto que representa")
  await expectErr("los productos deben ser de la empresa", () => loyalty.saveLoyaltyProgram(orgId, { kind: "visit_card", name: "zz Fid x", visitsRequired: 2, targetProductIds: ["nada"] }), "empresa")
  const visit = await loyalty.saveLoyaltyProgram(orgId, { kind: "visit_card", presetKey: "visit_5_free", name: "zz Fid Visitas", visitsRequired: 2, targetProductIds: [cut.id], discountPercent: 100 })
  created.programs.push(visit.id)
  const packProgram = await loyalty.saveLoyaltyProgram(orgId, { kind: "prepaid_pack", presetKey: "pack_5", name: "zz Fid Paquete", packUses: 3, packProductId: pack.id, targetProductIds: [cut.id], discountPercent: 100 })
  created.programs.push(packProgram.id)
  await expectErr("el paquete no se puede canjear por sí mismo", () => loyalty.saveLoyaltyProgram(orgId, { kind: "prepaid_pack", name: "zz Fid y", packUses: 3, packProductId: pack.id, targetProductIds: [pack.id] }), "sí mismo")
  await expectErr("un mismo producto no es paquete de dos programas", () => loyalty.saveLoyaltyProgram(orgId, { kind: "prepaid_pack", name: "zz Fid z", packUses: 3, packProductId: pack.id }), "ya es el paquete")

  // Tarjeta de visitas (2 visitas = 1 crédito)
  await sell([line(cut)])
  let c = await card(visit.id)
  check("una venta con el servicio suma una visita", c?.visits === 1 && c.credits === 0, `(${c?.visits}/${c?.credits})`)
  await sell([line(other)])
  c = await card(visit.id)
  check("una venta sin servicios del programa no suma", c?.visits === 1)
  await sell([line(cut)])
  c = await card(visit.id)
  check("la segunda visita da el crédito y reinicia el avance", c?.visits === 0 && c.credits === 1, `(${c?.visits}/${c?.credits})`)
  await sell([line(cut)], { customer: false })
  check("sin cliente no se acumula nada", (await card(visit.id))?.visits === 0)

  // Canje
  await expectErr("el monto del canje lo calcula el servidor", () => sell([line(cut)], { redeem: { programId: visit.id, amount: 80 } }), "no coincide")
  await expectErr("canjear sin cliente se rechaza", () => sell([line(cut)], { redeem: { programId: visit.id, amount: 100 }, customer: false }), "cliente")
  const inCustomer = await loyalty.getCustomerLoyalty(orgId, customer.id)
  check("el POS ve el crédito disponible", inCustomer.find((x) => x.programId === visit.id)?.credits === 1)
  const redeemed = await sell([line(cut), line(other)], { redeem: { programId: visit.id, amount: 100 } })
  const redeemedSale = await prisma.sale.findUniqueOrThrow({ where: { id: redeemed.id }, include: { discounts: true } })
  c = await card(visit.id)
  check("el canje descuenta el crédito y deja la venta con su descuento", c?.credits === 0 && Number(redeemedSale.discount) === 100 && redeemedSale.discounts.length === 1, `(${c?.credits}/${redeemedSale.discount})`)
  check("la venta que canjea no suma visita", c?.visits === 0)
  await expectErr("sin créditos no se puede canjear", () => sell([line(cut)], { redeem: { programId: visit.id, amount: 100 } }), "no tiene créditos")

  // Paquete prepagado
  await sell([line(pack)])
  const pc = await card(packProgram.id)
  check("comprar el paquete da 3 créditos", pc?.credits === 3, `(${pc?.credits})`)
  await sell([line(cut)], { redeem: { programId: packProgram.id, amount: 100 } })
  check("canjear un crédito del paquete deja 2", (await card(packProgram.id))?.credits === 2)
  await expectErr("el paquete no se paga con créditos de sí mismo", () => sell([line(pack)], { redeem: { programId: packProgram.id, amount: 270 } }), "nada que canjear")
  await sell([line(pack, 2)])
  check("dos paquetes dan 6 créditos más", (await card(packProgram.id))?.credits === 8)

  const listed = (await loyalty.listLoyaltyPrograms(orgId)).find((p) => p.id === packProgram.id)
  check("el dueño ve cuántos créditos hay en circulación", listed?.creditsOutstanding === 8 && listed.customersWithCredits === 1 && listed.packProductName === "zz Fid Paquete 3", `(${listed?.creditsOutstanding})`)

  // Membresía mensual
  const fee = await mkProduct("zz Fid Cuota mensual", 400)
  await expectErr("una membresía exige días de periodo válidos", () => loyalty.saveLoyaltyProgram(orgId, { kind: "membership", name: "zz Fid m", packUses: 2, packProductId: fee.id, periodDays: 0 }), "días")
  const member = await loyalty.saveLoyaltyProgram(orgId, { kind: "membership", presetKey: "member_4", name: "zz Fid Membresía", packUses: 2, packProductId: fee.id, targetProductIds: [cut.id], periodDays: 30, rollover: false, reminderDays: 3, terms: "Personal e intransferible" })
  created.programs.push(member.id)
  await expectErr("la cuota no puede ser la de otro programa", () => loyalty.saveLoyaltyProgram(orgId, { kind: "membership", name: "zz Fid m2", packUses: 2, packProductId: fee.id, periodDays: 30 }), "ya es el paquete o la cuota")
  await sell([line(fee)])
  let mc = await card(member.id)
  const days = (d: Date | null | undefined) => Math.round(((d?.getTime() ?? 0) - Date.now()) / 86_400_000)
  check("cobrar la cuota da de alta la membresía por 30 días con 2 créditos", mc?.credits === 2 && days(mc.expiresAt) === 30, `(${mc?.credits}/${days(mc?.expiresAt)})`)
  const det = (await loyalty.getCustomerLoyalty(orgId, customer.id)).find((x) => x.programId === member.id)!
  check("el cliente ve su membresía: activa, cuánto le queda y las condiciones", det.membership?.status === "active" && det.membership.daysLeft === 30 && det.credits === 2 && det.membership.terms === "Personal e intransferible" && det.membership.price === 400, `(${det.membership?.status}/${det.membership?.daysLeft})`)
  await sell([line(cut)], { redeem: { programId: member.id, amount: 100 } })
  check("canjear un servicio de la membresía deja 1", (await card(member.id))?.credits === 1)
  await sell([line(fee)])
  mc = await card(member.id)
  check("renovar a tiempo suma 30 días al vencimiento y repone créditos (sin acumular)", mc?.credits === 2 && days(mc.expiresAt) === 60, `(${mc?.credits}/${days(mc?.expiresAt)})`)
  const lines = await loyalty.loyaltyTicketLines(orgId, (created.sales[created.sales.length - 1]))
  check("el ticket de la cuota lleva la leyenda de vigencia", lines.some((l) => l.includes("vigente hasta") && l.includes("2 servicio")), `(${lines.join(" | ")})`)

  // Vencimiento
  await prisma.loyaltyCard.update({ where: { id: mc!.id }, data: { expiresAt: new Date(Date.now() - 86_400_000) } })
  const expired = (await loyalty.getCustomerLoyalty(orgId, customer.id)).find((x) => x.programId === member.id)!
  check("vencida: estado vencida y 0 créditos usables", expired.membership?.status === "expired" && expired.credits === 0)
  await expectErr("no se canjea con la membresía vencida", () => sell([line(cut)], { redeem: { programId: member.id, amount: 100 } }), "venció")
  await sell([line(fee)])
  mc = await card(member.id)
  check("renovar vencida cuenta desde hoy", mc?.credits === 2 && days(mc.expiresAt) === 30, `(${days(mc?.expiresAt)})`)

  // Acumular créditos (política del dueño)
  await loyalty.saveLoyaltyProgram(orgId, { rollover: true }, member.id)
  await sell([line(fee)])
  mc = await card(member.id)
  check("con acumulación, renovar a tiempo conserva los créditos sin usar", mc?.credits === 4 && days(mc.expiresAt) === 60, `(${mc?.credits}/${days(mc?.expiresAt)})`)

  // Aviso de vencimiento
  await prisma.loyaltyCard.update({ where: { id: mc!.id }, data: { expiresAt: new Date(Date.now() + 2 * 86_400_000), reminderSentAt: null } })
  const swept = await loyalty.sweepMembershipReminders(orgId)
  check("avisa a quien vence en los días configurados", swept.notified === 1, `(${swept.notified})`)
  check("no vuelve a avisar el mismo periodo", (await loyalty.sweepMembershipReminders(orgId)).notified === 0)

  // Cobro automático por la pasarela de pagos en línea de la empresa (opcional, desbloqueado por el superAdmin)
  const billing = await import("../../src/lib/loyalty/billing")
  const orgBefore = await prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { membershipAutoBilling: true, paymentGateway: true, currency: true } })
  const realFetch = globalThis.fetch
  const fetchCalls: string[] = []
  // Nunca se llama a la pasarela de verdad: Stripe se simula.
  globalThis.fetch = (async (url: any, init?: any) => {
    const u = String(url)
    if (u.includes("api.stripe.com/v1/checkout/sessions")) {
      fetchCalls.push(u)
      return new Response(JSON.stringify({ id: `cs_test_zz_${fetchCalls.length}`, url: `https://pay.example/cs_test_zz_${fetchCalls.length}` }), { status: 200, headers: { "Content-Type": "application/json" } })
    }
    return realFetch(url, init)
  }) as any
  try {
    await prisma.organization.update({ where: { id: orgId }, data: { membershipAutoBilling: false, paymentGateway: {} } })
    check("el cobro automático nace bloqueado", (await loyalty.getAutoBillingState(orgId)).unlocked === false)
    await expectErr("no se puede elegir el cobro automático mientras esté bloqueado", () => loyalty.saveLoyaltyProgram(orgId, { autoBilling: true }, member.id), "bloqueado")
    await expectErr("el cliente no activa la renovación automática estando bloqueada", () => loyalty.setCardAutoRenew(orgId, customer.id, { programId: member.id, enabled: true }), "bloqueado")
    check("sin desbloqueo el proceso de renovaciones no hace nada", (await billing.runAutoRenewals(orgId)).skipped === "locked")

    await loyalty.setAutoBillingUnlocked(orgId, true)
    const noGateway = await loyalty.getAutoBillingState(orgId)
    check("desbloqueado, pide registrar el proveedor de pagos en línea", noGateway.unlocked && !noGateway.providerAvailable && noGateway.message.includes("Ajustes → Pagos"))
    await expectErr("sin pasarela de pagos el cliente no puede activar la renovación", () => loyalty.setCardAutoRenew(orgId, customer.id, { programId: member.id, enabled: true }), "pagos en línea")
    check("sin pasarela el proceso solo lo informa", (await billing.runAutoRenewals(orgId)).skipped === "no_provider")

    // La empresa registra su pasarela (la misma de Ajustes → Pagos)
    await prisma.organization.update({ where: { id: orgId }, data: { paymentGateway: { provider: "stripe", stripe: { secretKey: "sk_test_zz", publicKey: "pk_test_zz", webhookSecret: "whsec_zz" }, mercadopago: { accessToken: "", publicKey: "", webhookSecret: "", pointEnabled: false, terminalId: "" } } } })
    check("con la pasarela registrada el proveedor está disponible", (await loyalty.getAutoBillingState(orgId)).providerAvailable === true)
    await loyalty.saveLoyaltyProgram(orgId, { autoBilling: true }, member.id)
    check("el dueño puede elegir el cobro automático en la membresía", (await prisma.loyaltyProgram.findUniqueOrThrow({ where: { id: member.id } })).autoBilling === true)

    // El cliente activa la renovación automática (la membresía vigente vence en 2 días; aviso 3 días antes)
    await loyalty.setCardAutoRenew(orgId, customer.id, { programId: member.id, enabled: true })
    let autoCard = await prisma.loyaltyCard.findUniqueOrThrow({ where: { id: mc!.id } })
    check("activar deja la renovación lista para cobrarse ya", autoCard.autoRenew && autoCard.billingStatus === "active" && autoCard.nextChargeAt !== null && autoCard.nextChargeAt.getTime() <= Date.now() + 1000)
    check("el portal ofrece la renovación automática", (await loyalty.getCustomerLoyalty(orgId, customer.id)).find((x) => x.programId === member.id)?.membership?.autoRenewAvailable === true)

    // Proceso diario: pide el enlace de pago, una sola vez por periodo
    const run1 = await billing.runAutoRenewals(orgId)
    const intent1 = await prisma.membershipPaymentIntent.findFirstOrThrow({ where: { cardId: mc!.id }, orderBy: { createdAt: "desc" } })
    check("el proceso pide el enlace de pago a la pasarela", run1.requested === 1 && fetchCalls.length === 1 && intent1.status === "pending" && Number(intent1.amount) === 400 && intent1.checkoutUrl === "https://pay.example/cs_test_zz_1", `(${run1.requested}/${fetchCalls.length}/${intent1.amount})`)
    check("la tarjeta queda esperando el pago y el cliente ve su enlace", (await prisma.loyaltyCard.findUniqueOrThrow({ where: { id: mc!.id } })).billingStatus === "awaiting_payment" && (await loyalty.getCustomerLoyalty(orgId, customer.id)).find((x) => x.programId === member.id)?.membership?.pendingPaymentUrl === "https://pay.example/cs_test_zz_1")
    check("correrlo otra vez no pide otro enlace del mismo periodo", (await billing.runAutoRenewals(orgId)).requested === 0 && fetchCalls.length === 1)

    // Webhook: monto distinto se rechaza; el correcto renueva y registra la venta de la cuota
    const expiresBefore = (await prisma.loyaltyCard.findUniqueOrThrow({ where: { id: mc!.id } })).expiresAt!.getTime()
    const creditsBefore = (await prisma.loyaltyCard.findUniqueOrThrow({ where: { id: mc!.id } })).credits
    check("un pago por otro monto no renueva", (await billing.markMembershipPaymentPaid(orgId, `membership:${intent1.id}`, "stripe", intent1.externalId!, 100, intent1.currency)).ok === false)
    check("un pago de otra empresa no renueva", (await billing.markMembershipPaymentPaid(orgs[4].orgId, `membership:${intent1.id}`, "stripe", intent1.externalId!, 400, intent1.currency)).ok === false)
    check("el pago correcto se acepta", (await billing.markMembershipPaymentPaid(orgId, `membership:${intent1.id}`, "stripe", intent1.externalId!, 400, intent1.currency)).ok === true)
    const paid1 = await prisma.membershipPaymentIntent.findUniqueOrThrow({ where: { id: intent1.id } })
    if (paid1.saleId) created.sales.push(paid1.saleId)
    const sale1 = paid1.saleId ? await prisma.sale.findUniqueOrThrow({ where: { id: paid1.saleId }, include: { payments: true } }) : null
    autoCard = await prisma.loyaltyCard.findUniqueOrThrow({ where: { id: mc!.id } })
    check("registra la venta de la cuota pagada con tarjeta, sin caja", paid1.status === "paid" && Number(sale1?.total) === 400 && sale1?.payments[0]?.method === "card" && sale1?.cashSessionId === null && sale1?.customerId === customer.id)
    check("la membresía se renovó: 30 días más y créditos repuestos", Math.round((autoCard.expiresAt!.getTime() - expiresBefore) / 86_400_000) === 30 && autoCard.credits >= creditsBefore + 2, `(${creditsBefore} → ${autoCard.credits})`)
    check("el siguiente cobro automático queda programado antes de vencer", autoCard.billingStatus === "active" && Math.round((autoCard.expiresAt!.getTime() - autoCard.nextChargeAt!.getTime()) / 86_400_000) === 3)
    const salesAfter = await prisma.sale.count({ where: { organizationId: orgId, items: { some: { productId: fee.id } } } })
    await billing.markMembershipPaymentPaid(orgId, `membership:${intent1.id}`, "stripe", intent1.externalId!, 400, intent1.currency)
    check("repetir el aviso de pago no duplica la venta", (await prisma.sale.count({ where: { organizationId: orgId, items: { some: { productId: fee.id } } } })) === salesAfter)

    // Enlace sin pagar: caduca, se avisa y la tarjeta queda marcada
    await prisma.loyaltyCard.update({ where: { id: mc!.id }, data: { nextChargeAt: new Date(Date.now() - 1000) } })
    const run2 = await billing.runAutoRenewals(orgId)
    const intent2 = await prisma.membershipPaymentIntent.findFirstOrThrow({ where: { cardId: mc!.id, status: "pending" } })
    check("el siguiente periodo pide un enlace nuevo", run2.requested === 1 && intent2.id !== intent1.id && fetchCalls.length === 2)
    await prisma.membershipPaymentIntent.update({ where: { id: intent2.id }, data: { createdAt: new Date(Date.now() - 4 * 86_400_000) } })
    const run3 = await billing.runAutoRenewals(orgId)
    const expiredCard = await prisma.loyaltyCard.findUniqueOrThrow({ where: { id: mc!.id } })
    check("sin pagar en 3 días el enlace caduca y la tarjeta lo refleja", run3.expired === 1 && (await prisma.membershipPaymentIntent.findUniqueOrThrow({ where: { id: intent2.id } })).status === "expired" && expiredCard.billingStatus === "failed")
    check("el cliente fue avisado (enlace, caducidad)", (await prisma.notification.count({ where: { organizationId: orgId, kind: { in: ["membership_payment", "membership_payment_expired"] }, createdAt: { gte: startedAt } } })) >= 0)

    // Bloquear de nuevo apaga todo
    await loyalty.setAutoBillingUnlocked(orgId, false)
    const relocked = await prisma.loyaltyCard.findUniqueOrThrow({ where: { id: mc!.id } })
    check("al bloquear se apagan las preferencias de cobro automático", relocked.autoRenew === false && relocked.billingStatus === "paused" && (await prisma.loyaltyProgram.findUniqueOrThrow({ where: { id: member.id } })).autoBilling === false)
    const authz = await import("../../src/lib/auth/permissions")
    check("loyalty.autobilling es exclusivo del superAdmin", authz.isSuperadminOnlyPermission("loyalty.autobilling") && authz.hasPermission({ user: { role: "owner", permissions: ["loyalty.autobilling"] } } as any, "loyalty.autobilling" as any) === false && authz.hasPermission({ user: { role: "superadmin", permissions: [] } } as any, "loyalty.autobilling" as any) === true)
  } finally {
    globalThis.fetch = realFetch
    await prisma.organization.update({ where: { id: orgId }, data: { membershipAutoBilling: orgBefore.membershipAutoBilling, paymentGateway: (orgBefore.paymentGateway ?? {}) as any } })
  }

  // Gestión manual de miembros
  const members = await loyalty.listMembers(orgId, member.id)
  const mine = members.find((m) => m.customerId === customer.id)
  check("la lista de miembros muestra al cliente con su vigencia", Boolean(mine) && mine!.status === "active" && mine!.daysLeft !== null, `(${mine?.status}/${mine?.daysLeft})`)
  await expectErr("las acciones sobre un miembro exigen motivo", () => loyalty.manageMember(orgId, member.id, customer.id, { action: "adjust", credits: 1, note: "" }), "motivo")
  const creditsBefore = (await card(member.id))!.credits
  await loyalty.manageMember(orgId, member.id, customer.id, { action: "adjust", credits: 2, note: "Cortesía de prueba" })
  check("ajustar suma créditos y deja movimiento", (await card(member.id))!.credits === creditsBefore + 2 && (await prisma.loyaltyMovement.count({ where: { cardId: mc!.id, type: "adjust", note: "Cortesía de prueba" } })) === 1)
  await expectErr("no se dejan créditos negativos", () => loyalty.manageMember(orgId, member.id, customer.id, { action: "adjust", credits: -99, note: "Error de prueba" }), "negativos")
  const expiresBefore = (await card(member.id))!.expiresAt!.getTime()
  await loyalty.manageMember(orgId, member.id, customer.id, { action: "extend", days: 5, note: "Retraso del negocio" })
  check("la cortesía suma días al vencimiento", Math.round(((await card(member.id))!.expiresAt!.getTime() - expiresBefore) / 86_400_000) === 5)
  await loyalty.manageMember(orgId, member.id, customer.id, { action: "cancel", note: "El cliente lo pidió" })
  const cancelled = (await loyalty.getCustomerLoyalty(orgId, customer.id)).find((x) => x.programId === member.id)!
  check("la baja termina la membresía y no se puede canjear", cancelled.credits === 0 && cancelled.membership?.cancelledAt !== null && (await loyalty.listMembers(orgId, member.id)).find((m) => m.customerId === customer.id)?.status === "cancelled")
  await expectErr("dada de baja no se canjea", () => sell([line(cut)], { redeem: { programId: member.id, amount: 100 } }), "venció")
  await sell([line(fee)])
  const back = (await loyalty.getCustomerLoyalty(orgId, customer.id)).find((x) => x.programId === member.id)!
  check("cobrar la cuota otra vez la reactiva y limpia la baja", back.membership?.status === "active" && back.membership.cancelledAt === null && back.credits > 0)
  await expectErr("otra empresa no gestiona los miembros", () => loyalty.manageMember(orgs[4].orgId, member.id, customer.id, { action: "cancel", note: "intento ajeno" }), "no encontrada")

  // Tipo de negocio: qué programas puede tener cada uno
  const savedPrograms = await prisma.loyaltyProgram.findMany({ where: { id: { in: created.programs } }, select: { id: true } })
  check("en servicios hay tarjeta, paquetes y membresías", (await loyalty.listLoyaltyPrograms(orgId)).filter((p) => created.programs.includes(p.id)).length === savedPrograms.length)
  await prisma.organization.update({ where: { id: orgId }, data: { businessMode: "retail" } })
  await expectErr("en una tienda no se crean paquetes", () => loyalty.saveLoyaltyProgram(orgId, { kind: "prepaid_pack", name: "zz Fid r1", packUses: 2, packProductId: cut.id }), "no disponible")
  await expectErr("en una tienda no se crean membresías", () => loyalty.saveLoyaltyProgram(orgId, { kind: "membership", name: "zz Fid r2", packUses: 2, packProductId: cut.id, periodDays: 30 }), "no disponible")
  const retailCard = await loyalty.saveLoyaltyProgram(orgId, { kind: "visit_card", name: "zz Fid tienda", visitsRequired: 3 })
  created.programs.push(retailCard.id)
  check("en una tienda sí se crea la tarjeta de visitas", Boolean(retailCard.id))
  const retailView = await loyalty.getCustomerLoyalty(orgId, customer.id)
  check("en una tienda el POS solo ve programas de visitas aunque haya otros guardados", retailView.length > 0 && retailView.every((x) => x.kind === "visit_card"), `(${retailView.map((x) => x.kind).join(",")})`)
  await prisma.organization.update({ where: { id: orgId }, data: { businessMode: "rental" } })
  await expectErr("en renta no hay fidelidad", () => loyalty.saveLoyaltyProgram(orgId, { kind: "visit_card", name: "zz Fid renta", visitsRequired: 3 }), "no disponible")
  check("en renta el POS no ve ningún programa", (await loyalty.getCustomerLoyalty(orgId, customer.id)).length === 0)
  await prisma.organization.update({ where: { id: orgId }, data: { businessMode: "services" } })

  // Otra empresa
  await expectErr("otra empresa no ve a este cliente", () => loyalty.getCustomerLoyalty(orgs[4].orgId, customer.id), "no encontrado")
  const foreign = await loyalty.listLoyaltyPrograms(orgs[4].orgId)
  check("otra empresa no ve los programas", !foreign.some((p) => created.programs.includes(p.id)))
} finally {
  await prisma.organization.update({ where: { id: orgId }, data: { businessMode: modeBefore } }).catch(() => undefined)
  await prisma.notification.deleteMany({ where: { organizationId: orgId, kind: { startsWith: "membership_" }, createdAt: { gte: startedAt } } })
  await prisma.membershipPaymentIntent.deleteMany({ where: { organizationId: orgId, programId: { in: created.programs } } })
  for (const saleId of created.sales) {
    await prisma.saleDiscount.deleteMany({ where: { saleId } })
    await prisma.salePayment.deleteMany({ where: { saleId } })
    await prisma.saleItem.deleteMany({ where: { saleId } })
  }
  await prisma.loyaltyMovement.deleteMany({ where: { card: { programId: { in: created.programs } } } })
  await prisma.loyaltyCard.deleteMany({ where: { programId: { in: created.programs } } })
  await prisma.loyaltyProgram.deleteMany({ where: { id: { in: created.programs } } })
  await prisma.sale.deleteMany({ where: { id: { in: created.sales } } }).catch(() => undefined)
  await prisma.productVariant.deleteMany({ where: { productId: { in: created.products } } })
  await prisma.product.deleteMany({ where: { id: { in: created.products } } }).catch(() => undefined)
  await prisma.$disconnect()
}
console.log(failures === 0 ? "TODO OK" : `${failures} FALLAS`)
process.exit(failures === 0 ? 0 : 1)
