/**
 * Siembra datos sintéticos de VOLUMEN en la base de pruebas aislada para medir escalabilidad.
 * Nunca toca la base real: exige TEST_DATABASE_CONFIRMED y un nombre multi_pos_test_*.
 *
 *   node scripts/test-env.mjs prepare minimal        (una vez: crea la base de pruebas)
 *   LOAD_ORGS=150 npx tsx scripts/loadtest/seed.ts
 *
 * Por empresa: 2 sucursales, caja abierta, categorías, productos con variante e inventario,
 * clientes (cada uno con su usuario), ventas con partidas y pagos repartidas en 90 días,
 * movimientos de inventario y pedidos del portal. Escribe .loadtest/orgs.json con las empresas
 * y un usuario dueño por cada una (para que run.mjs simule sesiones).
 */
import fs from "node:fs"
import { randomBytes } from "node:crypto"
import path from "node:path"

const envFile = path.resolve(".env.test-minimal.local")
if (!fs.existsSync(envFile)) throw new Error("Primero: node scripts/test-env.mjs prepare minimal")
const env = JSON.parse(fs.readFileSync(envFile, "utf8"))
Object.assign(process.env, env)
const { assertTestEnvironment } = await import("../test-safety.mjs")
assertTestEnvironment(process.env as Record<string, string>)

const { prisma } = await import("../../src/lib/db")

const ORGS = Number(process.env.LOAD_ORGS) || 120
const PRODUCTS = Number(process.env.LOAD_PRODUCTS) || 60
const CUSTOMERS = Number(process.env.LOAD_CUSTOMERS) || 100
const SALES = Number(process.env.LOAD_SALES) || 300
const ORDERS = Number(process.env.LOAD_ORDERS) || 80

const id = () => "c" + randomBytes(11).toString("hex")
const DAY = 86_400_000
const now = Date.now()
const pick = <T,>(items: T[], i: number) => items[i % items.length]

async function chunked<T>(rows: T[], size: number, write: (batch: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await write(rows.slice(i, i + size))
}

async function seedOrg(index: number) {
  const ownerId = id()
  const orgId = id()
  const locations = [id(), id()]
  const register = [id(), id()]
  const session = [id(), id()]
  const categories = Array.from({ length: 8 }, () => id())
  const products = Array.from({ length: PRODUCTS }, () => ({ id: id(), variantId: id() }))
  const customers = Array.from({ length: CUSTOMERS }, () => ({ id: id(), userId: id() }))
  const tag = `${index}-${randomBytes(3).toString("hex")}`

  await prisma.user.create({ data: { id: ownerId, email: `owner-${tag}@load.test`, passwordHash: "x", fullName: `Dueño ${index}` } })
  await prisma.organization.create({ data: { id: orgId, name: `Negocio de carga ${index}`, ownerId } })
  await prisma.membership.create({ data: { userId: ownerId, organizationId: orgId, role: "owner" } })
  await prisma.location.createMany({ data: locations.map((l, i) => ({ id: l, organizationId: orgId, name: `Sucursal ${i + 1}` })) })
  await prisma.cashRegister.createMany({ data: register.map((r, i) => ({ id: r, locationId: locations[i], organizationId: orgId, name: `Caja ${i + 1}` })) })
  await prisma.cashSession.createMany({ data: session.map((s, i) => ({ id: s, organizationId: orgId, locationId: locations[i], cashRegisterId: register[i] })) })
  await prisma.category.createMany({ data: categories.map((c, i) => ({ id: c, organizationId: orgId, name: `Categoría ${i + 1}` })) })
  await prisma.product.createMany({ data: products.map((p, i) => ({ id: p.id, organizationId: orgId, name: `Producto ${index}-${i + 1}`, categoryId: pick(categories, i) })) })
  await prisma.productVariant.createMany({
    data: products.map((p, i) => ({ id: p.variantId, productId: p.id, organizationId: orgId, name: "Default", price: 20 + (i % 80), cost: 10 + (i % 40), sku: `SKU-${index}-${i}` })),
  })
  await prisma.inventory.createMany({
    data: locations.flatMap((loc) => products.map((p, i) => ({ id: id(), organizationId: orgId, locationId: loc, locationType: "location" as const, variantId: p.variantId, productId: p.id, quantity: 5 + (i % 50), minThreshold: i % 7 === 0 ? 20 : 3 }))),
  })

  await chunked(customers, 500, async (batch) => {
    await prisma.user.createMany({ data: batch.map((c, i) => ({ id: c.userId, email: `cli-${tag}-${i}-${c.id.slice(-4)}@load.test`, passwordHash: "x", fullName: `Cliente ${i}` })) })
  })
  await chunked(customers, 500, async (batch) => {
    await prisma.customer.createMany({ data: batch.map((c, i) => ({ id: c.id, organizationId: orgId, userId: c.userId, fullName: `Cliente ${i} ${index}`, phone: `55${String(index).padStart(3, "0")}${String(i).padStart(5, "0")}`, customerCode: `C${index}-${i}`, points: i % 40 })) })
  })

  const sales = Array.from({ length: SALES }, (_, i) => ({ id: id(), at: new Date(now - Math.floor(Math.random() * 90 * DAY)), loc: i % 2, cust: customers[i % CUSTOMERS].id, total: 50 + (i % 400) }))
  await chunked(sales, 1000, async (batch) => {
    await prisma.sale.createMany({ data: batch.map((s) => ({ id: s.id, organizationId: orgId, locationId: locations[s.loc], cashSessionId: session[s.loc], cashRegisterId: register[s.loc], customerId: s.cust, subtotal: s.total, total: s.total, createdAt: s.at })) })
  })
  const items = sales.flatMap((s, i) => [0, 1, 2].map((k) => ({ id: id(), saleId: s.id, product: products[(i + k * 7) % PRODUCTS], at: s.at, loc: s.loc })))
  await chunked(items, 1500, async (batch) => {
    await prisma.saleItem.createMany({ data: batch.map((it) => ({ id: it.id, saleId: it.saleId, productId: it.product.id, variantId: it.product.variantId, productName: "Producto", productType: "standard" as const, quantity: 1, unitPrice: 25 })) })
  })
  await chunked(sales, 1500, async (batch) => {
    await prisma.salePayment.createMany({ data: batch.map((s) => ({ id: id(), saleId: s.id, method: "cash" as const, amount: s.total })) })
  })
  await chunked(items, 1500, async (batch) => {
    await prisma.inventoryMovement.createMany({ data: batch.map((it) => ({ id: id(), organizationId: orgId, productId: it.product.id, variantId: it.product.variantId, locationId: locations[it.loc], locationType: "location" as const, type: "sale" as const, quantity: -1, createdAt: it.at })) })
  })

  const statuses = ["pending", "confirmed", "preparing", "ready", "delivered", "delivered", "delivered", "cancelled"] as const
  const orders = Array.from({ length: ORDERS }, (_, i) => ({ id: id(), at: new Date(now - Math.floor(Math.random() * 60 * DAY)), status: pick([...statuses], i), cust: customers[i % CUSTOMERS].id }))
  await prisma.order.createMany({ data: orders.map((o, i) => ({ id: o.id, organizationId: orgId, locationId: locations[i % 2], customerId: o.cust, deliveryMethod: "pickup" as const, status: o.status, subtotal: 100, total: 100, createdAt: o.at })) })
  await prisma.orderItem.createMany({ data: orders.map((o, i) => ({ id: id(), orderId: o.id, productId: products[i % PRODUCTS].id, variantId: products[i % PRODUCTS].variantId, productName: "Producto", productType: "standard" as const, quantity: 1, unitPrice: 100 })) })

  return { orgId, ownerId, locationId: locations[0], customerUserId: customers[0].userId, customerId: customers[0].id }
}

const started = Date.now()
const created: Awaited<ReturnType<typeof seedOrg>>[] = []
// Se suman a lo que ya exista para poder crecer por etapas.
for (let i = 0; i < ORGS; i += 1) {
  created.push(await seedOrg(i))
  if ((i + 1) % 10 === 0) console.log(`  ${i + 1}/${ORGS} empresas · ${Math.round((Date.now() - started) / 1000)} s`)
}
fs.mkdirSync(".loadtest", { recursive: true })
fs.writeFileSync(".loadtest/orgs.json", JSON.stringify(created))
const counts = await prisma.$queryRawUnsafe<{ t: string; n: bigint }[]>("select 'sales' t, count(*) n from sales union all select 'sale_items', count(*) from sale_items union all select 'inventory_movements', count(*) from inventory_movements union all select 'orders', count(*) from orders union all select 'customers', count(*) from customers union all select 'products', count(*) from products")
console.log("filas:", counts.map((c) => `${c.t}=${Number(c.n).toLocaleString("es-MX")}`).join(" · "))
console.log(`listo en ${Math.round((Date.now() - started) / 1000)} s → .loadtest/orgs.json`)
await prisma.$disconnect()
