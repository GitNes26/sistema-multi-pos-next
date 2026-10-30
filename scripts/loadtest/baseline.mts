/* eslint-disable @typescript-eslint/no-explicit-any, no-var -- script de pruebas de carga */
/**
 * Comparación honesta de índices: deja solo el índice simple de la llave foránea (organizationId),
 * que es lo que había antes, mide las consultas típicas y luego restaura los índices compuestos.
 * Solo corre en la base de pruebas aislada (modifica índices temporalmente).
 *
 *   npx tsx scripts/loadtest/baseline.mts
 */
import fs from "node:fs"
import path from "node:path"

Object.assign(process.env, JSON.parse(fs.readFileSync(path.resolve(".env.test-minimal.local"), "utf8")))
const { assertTestEnvironment } = await import("../test-safety.mjs")
assertTestEnvironment(process.env as Record<string, string>)
const { prisma } = await import("../../src/lib/db")

const orgs = JSON.parse(fs.readFileSync(".loadtest/orgs.json", "utf8"))
const { orgId, locationId } = orgs[3]
const from = new Date(Date.now() - 30 * 86_400_000)
const to = new Date()
const lines = fs.readFileSync("prisma/migrations/20261030120000_scalability_indexes/migration.sql", "utf8").split("\n").filter((l) => l.startsWith("CREATE INDEX"))
const tables = ["sales", "inventory_movements", "products", "inventory"]
const mine = lines.filter((l) => tables.some((t) => l.includes(` ON \`${t}\``)))
const name = (l: string) => /`([^`]+)`/.exec(l)![1]
const tbl = (l: string) => /ON `([^`]+)`/.exec(l)![1]
const firstColumn = (l: string) => /ON `[^`]+`\(`([^`]+)`/.exec(l)![1]
const tmpKeys = [...new Map(mine.map((l) => [`${tbl(l)}.${firstColumn(l)}`, { t: tbl(l), c: firstColumn(l) }] as const)).values()]
const qs: [string, string, unknown[]][] = [
  ["ventas del mes", "SELECT COUNT(*) c, SUM(total) t FROM sales WHERE organizationId=? AND status='completed' AND createdAt BETWEEN ? AND ?", [orgId, from, to]],
  ["ventas recientes (20)", "SELECT id,total,createdAt FROM sales WHERE organizationId=? ORDER BY createdAt DESC LIMIT 20", [orgId]],
  ["movimientos recientes (50)", "SELECT id,quantity,createdAt FROM inventory_movements WHERE organizationId=? ORDER BY createdAt DESC LIMIT 50", [orgId]],
  ["movimientos sucursal mes", "SELECT COUNT(*) c FROM inventory_movements WHERE organizationId=? AND locationId=? AND createdAt >= ?", [orgId, locationId, from]],
  ["productos por nombre (20)", "SELECT id,name FROM products WHERE organizationId=? AND isActive=1 ORDER BY name LIMIT 20", [orgId]],
  ["existencias sucursal", "SELECT variantId,quantity FROM inventory WHERE organizationId=? AND locationId=? AND locationType='location'", [orgId, locationId]],
]
async function measure() {
  const out: Record<string, number> = {}
  for (const [n, sql, p] of qs) {
    await prisma.$queryRawUnsafe(sql, ...p)
    const t: number[] = []
    for (let i = 0; i < 15; i += 1) { const s = performance.now(); await prisma.$queryRawUnsafe(sql, ...p); t.push(performance.now() - s) }
    t.sort((a, b) => a - b)
    out[n] = t[7]
  }
  return out
}
const existing = new Set((await prisma.$queryRawUnsafe<{ n: string }[]>("select index_name n from information_schema.statistics where table_schema=database()")).map((r) => r.n))
try {
  // Un índice simple por cada llave foránea que los compuestos estaban cubriendo.
  for (const k of tmpKeys) await prisma.$executeRawUnsafe(`CREATE INDEX tmp_fk_${k.t}_${k.c} ON \`${k.t}\`(\`${k.c}\`)`)
  for (const l of mine) if (existing.has(name(l))) await prisma.$executeRawUnsafe(`DROP INDEX \`${name(l)}\` ON \`${tbl(l)}\``)
  for (const t of tables) await prisma.$executeRawUnsafe(`ANALYZE TABLE ${t}`)
  var before = await measure()
} finally {
  // Siempre se restauran los índices, aunque algo falle a medias.
  const now = new Set((await prisma.$queryRawUnsafe<{ n: string }[]>("select index_name n from information_schema.statistics where table_schema=database()")).map((r) => r.n))
  for (const l of mine) if (!now.has(name(l))) await prisma.$executeRawUnsafe(l.replace(/;$/, ""))
  for (const k of tmpKeys) { try { await prisma.$executeRawUnsafe(`DROP INDEX tmp_fk_${k.t}_${k.c} ON \`${k.t}\``) } catch { /* ya no existe */ } }
  for (const t of tables) await prisma.$executeRawUnsafe(`ANALYZE TABLE ${t}`)
}
const after = await measure()
console.log("Antes (solo el índice de la llave foránea) vs Después (índices compuestos) · mediana de 15 corridas, ms\n")
const result = qs.map(([n]) => ({ consulta: n, antesMs: Number(before[n].toFixed(1)), despuesMs: Number(after[n].toFixed(1)) }))
for (const r of result) console.log(`  ${r.consulta.padEnd(28)} ${String(r.antesMs).padStart(8)} → ${String(r.despuesMs).padStart(6)}  (${(r.antesMs / Math.max(r.despuesMs, 0.01)).toFixed(0)}×)`)
fs.writeFileSync(".loadtest/explain-baseline.json", JSON.stringify(result, null, 2))
await prisma.$disconnect()
