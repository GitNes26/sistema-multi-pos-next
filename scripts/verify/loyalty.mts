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

  // Otra empresa
  await expectErr("otra empresa no ve a este cliente", () => loyalty.getCustomerLoyalty(orgs[4].orgId, customer.id), "no encontrado")
  const foreign = await loyalty.listLoyaltyPrograms(orgs[4].orgId)
  check("otra empresa no ve los programas", !foreign.some((p) => created.programs.includes(p.id)))
} finally {
  await prisma.notification.deleteMany({ where: { organizationId: orgId, kind: "membership_expiring", createdAt: { gte: startedAt } } })
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
