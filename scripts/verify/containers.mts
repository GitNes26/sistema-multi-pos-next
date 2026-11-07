/* eslint-disable @typescript-eslint/no-explicit-any -- script de verificación */
// Verifica en la base aislada el importe de envases: se cobra aparte del total de la venta, se descuenta lo
// que el cliente trae, el servidor recalcula, no se devuelven más envases de los cobrados y el efectivo
// regresado entra al corte de caja. Limpia lo que crea.
import fs from "node:fs"
import path from "node:path"

Object.assign(process.env, JSON.parse(fs.readFileSync(path.resolve(".env.test-minimal.local"), "utf8")))
const { assertTestEnvironment } = await import("../test-safety.mjs")
assertTestEnvironment(process.env as Record<string, string>)
const { prisma } = await import("../../src/lib/db")
const pos = await import("../../src/lib/pos/server")
const dep = await import("../../src/lib/deposits/server")

const orgs = JSON.parse(fs.readFileSync(".loadtest/orgs.json", "utf8"))
const orgId = orgs[5].orgId as string
const otherOrgId = orgs[4].orgId as string
const user = await prisma.user.findFirstOrThrow({ select: { id: true } })
const location = await prisma.location.findFirstOrThrow({ where: { organizationId: orgId }, orderBy: { createdAt: "asc" } })
const register = await prisma.cashRegister.findFirstOrThrow({ where: { organizationId: orgId, locationId: location.id } })

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

const created = { products: [] as string[], sales: [] as string[], session: "" }
try {
  // Si ya hay una caja abierta en la sucursal se usa; si no, se abre una y se borra al final.
  const alreadyOpen = await prisma.cashSession.findFirst({ where: { organizationId: orgId, cashRegister: { locationId: location.id }, status: "open" } })
  let sessionId: string
  if (alreadyOpen) {
    sessionId = alreadyOpen.id
  } else {
    const opened = await pos.openCashSession(orgId, location.id, register.id, 100, user.id)
    sessionId = (opened.session as any).id
    created.session = sessionId
  }

  const mk = async (name: string, price: number, depositAmount: number) => {
    const p = await prisma.product.create({
      data: { organizationId: orgId, name, trackInventory: false, depositAmount, variants: { create: { organizationId: orgId, name: "Default", price } } },
      include: { variants: true },
    })
    created.products.push(p.id)
    return { productId: p.id, variantId: p.variants[0].id, name, price }
  }
  const cola = await mk("zz Refresco retornable", 20, 12)
  const plain = await mk("zz Botana", 10, 0)

  const item = (p: typeof cola, quantity: number) => ({
    productId: p.productId, variantId: p.variantId, productType: "standard" as const, productName: p.name, variantName: null,
    quantity, unitId: null, unitPrice: p.price, totalPrice: p.price * quantity, discount: 0, taxRate: 0, lineTotal: p.price * quantity, trackInventory: false,
  })
  const payload = (items: any[], paid: number, containers?: any[]) => {
    const subtotal = items.reduce((s, i) => s + i.totalPrice, 0)
    return {
      items, subtotal, discount: 0, tax: 0, total: subtotal, changeGiven: 0, pointsEarned: 0, pointsRedeemed: 0, pointsRedeemedValue: 0,
      payments: [{ method: "cash" as const, amount: paid }], discounts: [], cashSessionId: sessionId, cashRegisterId: register.id, containers,
    } as any
  }
  const ctx = { userId: user.id, employeeId: null }

  // 5 refrescos = 100 de venta + 5×12 = 60 de envases si no trae ninguno.
  await expectErr("pagar solo el total no cubre el importe de envases", () => pos.createSale(orgId, location.id, payload([item(cola, 5)], 100), ctx), "envases")
  const s1 = await pos.createSale(orgId, location.id, payload([item(cola, 5)], 160), ctx)
  created.sales.push(s1.id)
  const row1 = await prisma.sale.findUniqueOrThrow({ where: { id: s1.id } })
  check("el importe queda fuera del total de la venta", Number(row1.total) === 100 && Number(row1.depositCharged) === 60, `(${row1.total}/${row1.depositCharged})`)

  // Trae 2 envases: solo se cobran 3 × 12 = 36.
  const s2 = await pos.createSale(orgId, location.id, payload([item(cola, 5), item(plain, 1)], 146, [{ productId: cola.productId, brought: 2 }]), ctx)
  created.sales.push(s2.id)
  const row2 = await prisma.sale.findUniqueOrThrow({ where: { id: s2.id } })
  check("si trae 2 envases solo se cobran 3 (36)", Number(row2.depositCharged) === 36, `(${row2.depositCharged})`)
  check("el producto sin importe no genera cobro", (await prisma.depositEntry.count({ where: { saleId: s2.id, productId: plain.productId } })) === 0)

  await expectErr("no puede traer más envases que piezas compradas", () => pos.createSale(orgId, location.id, payload([item(cola, 2)], 100, [{ productId: cola.productId, brought: 3 }]), ctx), "no puedes traer")
  await expectErr("un producto sin importe no acepta envases", () => pos.createSale(orgId, location.id, payload([item(plain, 1)], 100, [{ productId: plain.productId, brought: 1 }]), ctx), "no maneja importe")
  await expectErr("envases negativos se rechazan", () => pos.createSale(orgId, location.id, payload([item(cola, 2)], 100, [{ productId: cola.productId, brought: -1 }]), ctx), "inválida")

  // Todos canjeados: no se cobra importe.
  const s3 = await pos.createSale(orgId, location.id, payload([item(cola, 2)], 40, [{ productId: cola.productId, brought: 2 }]), ctx)
  created.sales.push(s3.id)
  check("canje completo: sin importe", Number((await prisma.sale.findUniqueOrThrow({ where: { id: s3.id } })).depositCharged) === 0)

  // Saldo en circulación: 5 + 3 = 8 cobrados.
  const balances = await dep.getContainerBalances(orgId, location.id)
  const bal = balances.find((b) => b.productId === cola.productId)
  check("envases en circulación = 8 (96)", bal?.outstanding === 8 && bal.amount === 96, `(${bal?.outstanding}/${bal?.amount})`)

  // Devolución
  await expectErr("no se devuelven más de los pendientes", () => dep.refundContainers(orgId, location.id, { productId: cola.productId, quantity: 9 }, { userId: user.id }), "pendiente")
  await expectErr("cantidad cero se rechaza", () => dep.refundContainers(orgId, location.id, { productId: cola.productId, quantity: 0 }, { userId: user.id }), "cuántos")
  await expectErr("un producto sin importe no se devuelve", () => dep.refundContainers(orgId, location.id, { productId: plain.productId, quantity: 1 }, { userId: user.id }), "no maneja importe")
  await expectErr("otra empresa no devuelve envases ajenos", () => dep.refundContainers(otherOrgId, location.id, { productId: cola.productId, quantity: 1 }, { userId: user.id }), "")
  const r = await dep.refundContainers(orgId, location.id, { productId: cola.productId, quantity: 3 }, { userId: user.id })
  check("se regresan 36 por 3 envases y quedan 5", r.amount === 36 && r.pending === 5, `(${r.amount}/${r.pending})`)
  check("el efectivo regresado entra al corte", (await dep.depositCashRefunds(prisma, sessionId)) >= 36)

  // El catálogo cambió el importe: se regresa lo que se cobró.
  await prisma.product.update({ where: { id: cola.productId }, data: { depositAmount: 20 } })
  const r2 = await dep.refundContainers(orgId, location.id, { productId: cola.productId, quantity: 1 }, { userId: user.id })
  check("se regresa el importe cobrado, no el actual del catálogo", r2.amount === 12, `(${r2.amount})`)
} finally {
  await prisma.depositEntry.deleteMany({ where: { organizationId: orgId, productId: { in: created.products } } })
  for (const id of created.sales) {
    await prisma.salePayment.deleteMany({ where: { saleId: id } })
    await prisma.saleItem.deleteMany({ where: { saleId: id } })
    await prisma.sale.delete({ where: { id } })
  }
  for (const id of created.products) {
    await prisma.productVariant.deleteMany({ where: { productId: id } })
    await prisma.product.delete({ where: { id } })
  }
  if (created.session) await prisma.cashSession.delete({ where: { id: created.session } })
  await prisma.$disconnect()
}
console.log(failures === 0 ? "TODO OK" : `${failures} FALLAS`)
process.exit(failures === 0 ? 0 : 1)
