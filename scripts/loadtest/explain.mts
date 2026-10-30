/* eslint-disable @typescript-eslint/no-explicit-any, no-var -- script de pruebas de carga */
/**
 * Mide el efecto de los índices nuevos: ejecuta las consultas típicas de una empresa CON los
 * índices y otra vez ignorándolos (el plan que existía antes), y muestra filas revisadas y tiempo.
 * Usa la base de pruebas aislada que llenó seed.mts.
 *
 *   npx tsx scripts/loadtest/explain.mts
 */
import fs from "node:fs"
import path from "node:path"

const env = JSON.parse(fs.readFileSync(path.resolve(".env.test-minimal.local"), "utf8"))
Object.assign(process.env, env)
const { assertTestEnvironment } = await import("../test-safety.mjs")
assertTestEnvironment(process.env as Record<string, string>)
const { prisma } = await import("../../src/lib/db")

const orgs: { orgId: string; locationId: string }[] = JSON.parse(fs.readFileSync(".loadtest/orgs.json", "utf8"))
const { orgId, locationId } = orgs[3]
const from = new Date(Date.now() - 30 * 86_400_000)
const to = new Date()

interface Case { name: string; table: string; ignore: string[]; sql: (ignore: string) => string; params: unknown[] }
const cases: Case[] = [
  {
    name: "Reporte de ventas del mes (empresa + rango de fechas)",
    table: "sales",
    ignore: ["sales_organizationId_createdAt_idx", "sales_organizationId_locationId_createdAt_idx", "sales_organizationId_status_createdAt_idx"],
    sql: (i) => `SELECT COUNT(*) c, SUM(total) t FROM sales ${i} WHERE organizationId=? AND status='completed' AND createdAt BETWEEN ? AND ?`,
    params: [orgId, from, to],
  },
  {
    name: "Lista de ventas recientes (20 últimas)",
    table: "sales",
    ignore: ["sales_organizationId_createdAt_idx", "sales_organizationId_locationId_createdAt_idx", "sales_organizationId_status_createdAt_idx"],
    sql: (i) => `SELECT id, total, createdAt FROM sales ${i} WHERE organizationId=? ORDER BY createdAt DESC LIMIT 20`,
    params: [orgId],
  },
  {
    name: "Historial de movimientos de inventario (50 últimos)",
    table: "inventory_movements",
    ignore: ["inventory_movements_organizationId_createdAt_idx", "inventory_movements_organizationId_locationId_createdAt_idx", "inventory_movements_variantId_createdAt_idx"],
    sql: (i) => `SELECT id, quantity, createdAt FROM inventory_movements ${i} WHERE organizationId=? ORDER BY createdAt DESC LIMIT 50`,
    params: [orgId],
  },
  {
    name: "Movimientos de una sucursal en el mes",
    table: "inventory_movements",
    ignore: ["inventory_movements_organizationId_createdAt_idx", "inventory_movements_organizationId_locationId_createdAt_idx", "inventory_movements_variantId_createdAt_idx"],
    sql: (i) => `SELECT COUNT(*) c FROM inventory_movements ${i} WHERE organizationId=? AND locationId=? AND createdAt >= ?`,
    params: [orgId, locationId, from],
  },
  {
    name: "Catálogo: productos activos por nombre (página de 20)",
    table: "products",
    ignore: ["products_organizationId_isActive_name_idx", "products_organizationId_categoryId_idx"],
    sql: (i) => `SELECT id, name FROM products ${i} WHERE organizationId=? AND isActive=1 ORDER BY name LIMIT 20`,
    params: [orgId],
  },
  {
    name: "Pedidos abiertos de una sucursal (panel en vivo)",
    table: "orders",
    ignore: ["orders_organizationId_createdAt_idx", "orders_organizationId_locationId_status_idx", "orders_organizationId_customerId_createdAt_idx"],
    sql: (i) => `SELECT COUNT(*) c FROM orders ${i} WHERE organizationId=? AND locationId=? AND status IN ('pending','confirmed','preparing','ready')`,
    params: [orgId, locationId],
  },
  {
    name: "Existencias de una sucursal",
    table: "inventory",
    ignore: ["inventory_organizationId_locationId_locationType_idx"],
    sql: (i) => `SELECT variantId, quantity FROM inventory ${i} WHERE organizationId=? AND locationId=? AND locationType='location'`,
    params: [orgId, locationId],
  },
  {
    name: "Inicio de sesión por teléfono (búsqueda exacta)",
    table: "customers",
    ignore: ["customers_phone_idx"],
    sql: (i) => `SELECT id FROM customers ${i} WHERE phone=?`,
    params: ["55003000003"],
  },
]

async function run(c: Case, withIndexes: boolean) {
  const ignore = withIndexes ? "" : `IGNORE INDEX (${c.ignore.join(", ")})`
  const sql = c.sql(ignore)
  const plan = (await prisma.$queryRawUnsafe<any[]>(`EXPLAIN ${sql}`, ...c.params))[0]
  // 1 calentamiento + 15 medidas.
  await prisma.$queryRawUnsafe(sql, ...c.params)
  const times: number[] = []
  for (let i = 0; i < 15; i += 1) {
    const t = performance.now()
    await prisma.$queryRawUnsafe(sql, ...c.params)
    times.push(performance.now() - t)
  }
  times.sort((a, b) => a - b)
  // Prisma devuelve las columnas de EXPLAIN como f0…f11: f6 = índice usado, f9 = filas estimadas, f11 = Extra.
  return { key: plan.f6 ?? "—", rows: Number(plan.f9), extra: String(plan.f11 ?? ""), ms: times[Math.floor(times.length / 2)] }
}

const totals = await prisma.$queryRawUnsafe<{ t: string; n: bigint }[]>("select 'sales' t, count(*) n from sales union all select 'inventory_movements', count(*) from inventory_movements union all select 'products', count(*) from products union all select 'orders', count(*) from orders union all select 'customers', count(*) from customers")
console.log("Volumen:", totals.map((x) => `${x.t}=${Number(x.n).toLocaleString("es-MX")}`).join(" · "), "\n")
const out: any[] = []
for (const c of cases) {
  const before = await run(c, false)
  const after = await run(c, true)
  out.push({ caso: c.name, antes: before, despues: after })
  console.log(c.name)
  console.log(`   antes   : ${before.rows.toLocaleString("es-MX").padStart(9)} filas revisadas · ${before.ms.toFixed(1).padStart(7)} ms · índice ${before.key}${before.extra.includes("filesort") ? " · ORDENA TODO (filesort)" : ""}`)
  console.log(`   después : ${after.rows.toLocaleString("es-MX").padStart(9)} filas revisadas · ${after.ms.toFixed(1).padStart(7)} ms · índice ${after.key}${after.extra.includes("filesort") ? " · filesort" : ""}   → ${(before.ms / Math.max(after.ms, 0.01)).toFixed(1)}× más rápido\n`)
}
fs.mkdirSync(".loadtest", { recursive: true })
fs.writeFileSync(".loadtest/explain.json", JSON.stringify(out, null, 2))
await prisma.$disconnect()
