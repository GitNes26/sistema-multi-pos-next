/**
 * Convierte una de las empresas sembradas en una "empresa grande con años de historia":
 * multiplica sus ventas y movimientos de inventario (copias con ids nuevos). Sirve para ver cómo
 * se comportan las consultas cuando UNA empresa acumula cientos de miles de filas.
 *
 *   LOAD_WHALE_DOUBLINGS=7 npx tsx scripts/loadtest/whale.mts      (×128)
 */
import fs from "node:fs"
import path from "node:path"

Object.assign(process.env, JSON.parse(fs.readFileSync(path.resolve(".env.test-minimal.local"), "utf8")))
const { assertTestEnvironment } = await import("../test-safety.mjs")
assertTestEnvironment(process.env as Record<string, string>)
const { prisma } = await import("../../src/lib/db")
const orgs = JSON.parse(fs.readFileSync(".loadtest/orgs.json", "utf8"))
const { orgId } = orgs[3]
const doublings = Number(process.env.LOAD_WHALE_DOUBLINGS) || 7

for (const [table, skip] of [["sales", ["id", "saleNumber"]], ["inventory_movements", ["id"]]] as const) {
  const cols = (await prisma.$queryRawUnsafe<{ c: string }[]>("select column_name c from information_schema.columns where table_schema=database() and table_name=? order by ordinal_position", table)).map((r) => r.c).filter((c) => !skip.includes(c as never))
  const list = cols.map((c) => `\`${c}\``).join(", ")
  for (let i = 0; i < doublings; i += 1) {
    await prisma.$executeRawUnsafe(`INSERT INTO \`${table}\` (id, ${list}) SELECT CONCAT('w', REPLACE(UUID(),'-','')), ${list} FROM \`${table}\` WHERE organizationId = ?`, orgId)
  }
  const n = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`select count(*) n from \`${table}\` where organizationId=?`, orgId)
  console.log(`${table}: ${Number(n[0].n).toLocaleString("es-MX")} filas en la empresa grande`)
}
await prisma.$executeRawUnsafe("ANALYZE TABLE sales")
await prisma.$executeRawUnsafe("ANALYZE TABLE inventory_movements")
await prisma.$disconnect()
