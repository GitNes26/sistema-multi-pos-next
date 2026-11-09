/* eslint-disable @typescript-eslint/no-explicit-any -- script de verificación */
// Verifica en la base aislada las garantías de servicio: reglas configurables, ventana de horas y «mismo día»,
// canje con el ticket (monto calculado por el servidor, una vez por ticket), leyenda del ticket, solicitud desde el
// portal y aislamiento entre empresas. Limpia lo que crea.
import fs from "node:fs"
import path from "node:path"

Object.assign(process.env, JSON.parse(fs.readFileSync(path.resolve(".env.test-minimal.local"), "utf8")))
const { assertTestEnvironment } = await import("../test-safety.mjs")
assertTestEnvironment(process.env as Record<string, string>)
const { prisma } = await import("../../src/lib/db")
const warranty = await import("../../src/lib/warranty/server")
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

const created = { products: [] as string[], rules: [] as string[], sales: [] as string[] }
const mkProduct = async (name: string, price: number, trackInventory = false) => {
  const p = await prisma.product.create({ data: { organizationId: orgId, name, trackInventory, taxRate: 0, variants: { create: { organizationId: orgId, name: "Default", price } } }, include: { variants: true } })
  created.products.push(p.id)
  return { id: p.id, variantId: p.variants[0].id, price, name }
}
const line = (p: { id: string; variantId: string; price: number; name: string }) => ({
  productId: p.id, variantId: p.variantId, productType: "standard" as const, productName: p.name, variantName: null, quantity: 1, unitId: null,
  unitPrice: p.price, totalPrice: p.price, discount: 0, taxRate: 0, lineTotal: p.price, trackInventory: false, extraPrice: 0,
})
const sell = async (p: ReturnType<typeof line>, opts: { claim?: { ruleId: string; saleId: string; amount: number }; customer?: boolean } = {}) => {
  const discount = opts.claim?.amount ?? 0
  const item = { ...p, discount, lineTotal: p.totalPrice - discount }
  const total = p.totalPrice - discount
  const sale = await createSale(orgId, location.id, {
    items: [item] as any, customerId: opts.customer ? customer.id : undefined, subtotal: p.totalPrice, discount, tax: 0, total, changeGiven: 0,
    pointsEarned: 0, pointsRedeemed: 0, pointsRedeemedValue: 0, payments: total > 0 ? [{ method: "cash", amount: total }] : [],
    discounts: opts.claim ? [{ label: "Garantía", amount: discount, warrantyRuleId: opts.claim.ruleId, warrantySaleId: opts.claim.saleId }] : [],
  } as any, { userId: user.id, employeeId: null })
  created.sales.push(sale.id)
  return sale
}

async function cleanup() {
  const old = await prisma.product.findMany({ where: { organizationId: orgId, name: { startsWith: "zz Gar" } }, select: { id: true } })
  const ids = old.map((p) => p.id)
  const sales = await prisma.sale.findMany({ where: { organizationId: orgId, items: { some: { productId: { in: ids } } } }, select: { id: true } })
  for (const s of sales) {
    await prisma.saleDiscount.deleteMany({ where: { saleId: s.id } })
    await prisma.salePayment.deleteMany({ where: { saleId: s.id } })
    await prisma.saleItem.deleteMany({ where: { saleId: s.id } })
  }
  await prisma.warrantyClaim.deleteMany({ where: { organizationId: orgId, rule: { name: { startsWith: "zz Gar" } } } })
  await prisma.warrantyRule.deleteMany({ where: { organizationId: orgId, name: { startsWith: "zz Gar" } } })
  await prisma.sale.deleteMany({ where: { id: { in: sales.map((s) => s.id) } } })
  await prisma.productVariant.deleteMany({ where: { productId: { in: ids } } })
  await prisma.product.deleteMany({ where: { id: { in: ids } } })
}

try {
  await cleanup()
  const full = await mkProduct("zz Gar Lavado completo", 150)
  const outer = await mkProduct("zz Gar Lavado exterior", 80)
  const soda = await mkProduct("zz Gar Refresco", 30, true)

  await expectErr("el porcentaje debe estar entre 1 y 100", () => warranty.saveWarrantyRule(orgId, { name: "zz Gar x", discountPercent: 150 }), "porcentaje")
  await expectErr("los servicios deben ser de la empresa", () => warranty.saveWarrantyRule(orgId, { name: "zz Gar x", appliesToProductIds: ["nada"] }), "empresa")
  const rain = await warranty.saveWarrantyRule(orgId, { presetKey: "rain_same_day", name: "zz Gar Lluvia", appliesToProductIds: [full.id], coversProductIds: [outer.id], windowHours: 24, sameDayOnly: true, discountPercent: 100 })
  created.rules.push(rain.id)

  const legends = await warranty.warrantyTicketLegends(orgId, [{ productId: full.id }])
  check("el ticket del servicio cubierto lleva la leyenda con las condiciones", legends.length === 1 && legends[0].includes("mismo día") && legends[0].includes("sin costo"), `(${legends[0]})`)
  check("sin servicios cubiertos no hay leyenda", (await warranty.warrantyTicketLegends(orgId, [{ productId: soda.id }])).length === 0 && (await warranty.warrantyTicketLegends(orgId, [{ productId: outer.id }])).length === 0)

  const original = await sell(line(full), { customer: true })
  const originalRow = await prisma.sale.findUniqueOrThrow({ where: { id: original.id } })
  const number = String(originalRow.locationSaleNumber)
  const info = await warranty.evaluateWarranty(orgId, { saleNumber: `#${number}`, locationId: location.id })
  check("con el número del ticket se encuentra la venta y su garantía", info?.saleId === original.id && info.offers.length === 1 && info.offers[0].coversProductIds[0] === outer.id, `(${info?.offers.length})`)

  await expectErr("el monto de la garantía lo calcula el servidor", () => sell(line(outer), { claim: { ruleId: rain.id, saleId: original.id, amount: 40 } }), "no coincide")
  await expectErr("la garantía solo cubre los servicios configurados", () => sell(line(full), { claim: { ruleId: rain.id, saleId: original.id, amount: 150 } }), "no hay ningún servicio")
  const redo = await sell(line(outer), { claim: { ruleId: rain.id, saleId: original.id, amount: 80 } })
  const redoRow = await prisma.sale.findUniqueOrThrow({ where: { id: redo.id } })
  const claim = await prisma.warrantyClaim.findUniqueOrThrow({ where: { saleId_ruleId: { saleId: original.id, ruleId: rain.id } } })
  check("canjear la garantía deja la venta sin costo y registra el uso", Number(redoRow.total) === 0 && claim.status === "used" && claim.usedSaleId === redo.id)
  check("el mismo ticket ya no ofrece la garantía", (await warranty.evaluateWarranty(orgId, { saleId: original.id }))!.offers.length === 0)
  await expectErr("no se canjea dos veces", () => sell(line(outer), { claim: { ruleId: rain.id, saleId: original.id, amount: 80 } }), "ya no está vigente")

  // Ventana y «mismo día»
  const yesterday = await sell(line(full))
  await prisma.sale.update({ where: { id: yesterday.id }, data: { createdAt: new Date(Date.now() - 30 * 3_600_000) } })
  check("pasadas las horas de vigencia no hay garantía", (await warranty.evaluateWarranty(orgId, { saleId: yesterday.id }))!.offers.length === 0)
  const prior = await prisma.warrantyRule.update({ where: { id: rain.id }, data: { windowHours: 72 } })
  check("con el mismo día obligatorio, el día anterior no cubre aunque la ventana sea larga", prior.windowHours === 72 && (await warranty.evaluateWarranty(orgId, { saleId: yesterday.id }))!.offers.length === 0)
  await prisma.warrantyRule.update({ where: { id: rain.id }, data: { sameDayOnly: false } })
  check("sin «mismo día», la ventana de 72 horas sí cubre", (await warranty.evaluateWarranty(orgId, { saleId: yesterday.id }))!.offers.length === 1)
  await warranty.saveWarrantyRule(orgId, { isActive: false }, rain.id)
  check("con la garantía pausada no hay oferta ni leyenda", (await warranty.evaluateWarranty(orgId, { saleId: yesterday.id }))!.offers.length === 0 && (await warranty.warrantyTicketLegends(orgId, [{ productId: full.id }])).length === 0)
  await warranty.saveWarrantyRule(orgId, { isActive: true, windowHours: 24, sameDayOnly: false, discountPercent: 50 }, rain.id)

  // Portal: el cliente la pide con su ticket
  const mine = await sell(line(full), { customer: true })
  const list = await warranty.listCustomerWarranties(orgId, customer.id)
  check("el portal lista las garantías vigentes del cliente", list.some((s) => s.saleId === mine.id && s.offers.length === 1))
  await expectErr("no se pide la garantía de un ticket ajeno", () => warranty.requestWarranty(orgId, "otro-cliente", { saleId: mine.id, ruleId: rain.id }), "no encontrado")
  await warranty.requestWarranty(orgId, customer.id, { saleId: mine.id, ruleId: rain.id, reason: "Llovió" })
  await expectErr("pedirla dos veces se rechaza", () => warranty.requestWarranty(orgId, customer.id, { saleId: mine.id, ruleId: rain.id }), "ya pediste")
  const requested = (await warranty.evaluateWarranty(orgId, { saleId: mine.id }))!.offers[0]
  check("la oferta queda marcada como solicitada", requested.claimStatus === "requested")
  const half = await sell(line(outer), { claim: { ruleId: rain.id, saleId: mine.id, amount: 40 } })
  const halfRow = await prisma.sale.findUniqueOrThrow({ where: { id: half.id } })
  check("con 50% se cobra la mitad y la solicitud pasa a usada", Number(halfRow.total) === 40 && (await prisma.warrantyClaim.findUniqueOrThrow({ where: { saleId_ruleId: { saleId: mine.id, ruleId: rain.id } } })).status === "used")

  check("otra empresa no encuentra el ticket", (await warranty.evaluateWarranty(orgs[4].orgId, { saleId: mine.id })) === null)
  check("otra empresa no ve las reglas", !(await warranty.listWarrantyRules(orgs[4].orgId)).some((r) => created.rules.includes(r.id)))
} finally {
  await cleanup()
  await prisma.$disconnect()
}
console.log(failures === 0 ? "TODO OK" : `${failures} FALLAS`)
process.exit(failures === 0 ? 0 : 1)
