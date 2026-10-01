// Extrae de un mysqldump la información de la empresa NESSIK Test a un JSON
// que usa el seeder (prisma/seeders/nessik-test.ts), conservando los ids.
// Uso: node scripts/extract-seed-from-dump.mjs <dump.sql> [salida.json]
// No copia contraseñas, credenciales de pasarela ni tokens.
import fs from "node:fs"

const [src, out = "prisma/seeders/data/nessik-test.json"] = process.argv.slice(2)
if (!src) throw new Error("Indica el archivo .sql")
const sql = fs.readFileSync(src, "utf8").replaceAll("\r\n", "\n")

// ── columnas por tabla ──
const columns = {}
for (const m of sql.matchAll(/CREATE TABLE `(\w+)` \(\n([\s\S]*?)\n\) ENGINE/g)) {
  columns[m[1]] = [...m[2].matchAll(/^\s+`(\w+)` /gm)].map((c) => c[1])
}

// ── parser de tuplas VALUES ──
function parseValues(text) {
  const rows = []
  let i = 0
  const n = text.length
  while (i < n) {
    if (text[i] !== "(") { i++; continue }
    i++
    const row = []
    for (;;) {
      while (text[i] === " ") i++
      let v
      if (text[i] === "'") {
        i++
        let s = ""
        while (i < n) {
          const ch = text[i]
          if (ch === "\\") {
            const nx = text[i + 1]
            s += nx === "n" ? "\n" : nx === "r" ? "\r" : nx === "t" ? "\t" : nx === "0" ? "\0" : nx === "Z" ? "\x1a" : nx
            i += 2
          } else if (ch === "'") {
            if (text[i + 1] === "'") { s += "'"; i += 2 } else { i++; break }
          } else { s += ch; i++ }
        }
        v = s
      } else {
        let j = i
        while (text[j] !== "," && text[j] !== ")") j++
        const tok = text.slice(i, j).trim()
        v = tok === "NULL" ? null : Number.isNaN(Number(tok)) ? tok : tok
        i = j
      }
      row.push(v)
      if (text[i] === ",") { i++; continue }
      if (text[i] === ")") { i++; break }
    }
    rows.push(row)
  }
  return rows
}

const tables = {}
for (const m of sql.matchAll(/^INSERT INTO `(\w+)` VALUES (.*);$/gm)) {
  const cols = columns[m[1]]
  tables[m[1]] = parseValues(m[2]).map((r) => Object.fromEntries(cols.map((c, k) => [c, r[k]])))
}

// ── limpieza de datos sensibles ──
for (const u of tables.users ?? []) u.passwordHash = null
const SENSITIVE = /token|secret|password|hash|apikey|accesskey/i
for (const [t, rows] of Object.entries(tables)) {
  for (const r of rows) for (const k of Object.keys(r)) if (SENSITIVE.test(k) && t !== "users" && r[k]) r[k] = null
}
for (const o of tables.organizations ?? []) o.paymentConfig = null

for (const o of tables.organizations ?? []) o.paymentGateway = null

// ── recorte: solo lo que el seeder carga ──
// Se omiten tablas globales/de configuración que ya siembra producción, las
// notificaciones, las devoluciones (se prueban a mano) y personas reales.
const DROP = ["permissions", "roles", "role_permissions", "menus", "units_of_measure", "subscription_plans", "organization_subscriptions", "notifications", "sale_returns", "sale_return_items", "sale_return_payments"]
// Unidades: solo (id, abreviatura) para enlazarlas con las del seeder de producción
const units = (tables.units_of_measure ?? []).map((u) => ({ id: u.id, abbreviation: u.abbreviation }))
for (const t of DROP) delete tables[t]
const keepUser = (u) => /@nessik\.(test|net)$/.test(u.email)
const dropped = new Set((tables.users ?? []).filter((u) => !keepUser(u)).map((u) => u.id))
tables.users = (tables.users ?? []).filter(keepUser).map((u) => ({ id: u.id, email: u.email, fullName: u.fullName, isSuperadmin: u.isSuperadmin }))
tables.memberships = (tables.memberships ?? []).filter((m) => !dropped.has(m.userId))
tables.employees = (tables.employees ?? []).filter((e) => !dropped.has(e.userId))
const droppedEmployees = new Set((tables.employees ?? []).length ? [] : [])
tables.inventory_movements = (tables.inventory_movements ?? []).filter((m) => m.type !== "return")
// Referencias a personas omitidas quedan en NULL
for (const rows of Object.values(tables)) for (const r of rows) for (const k of Object.keys(r)) if (dropped.has(r[k])) r[k] = null

const report = Object.fromEntries(Object.entries(tables).map(([t, r]) => [t, r.length]))
fs.mkdirSync(out.replace(/[\\/][^\\/]*$/, ""), { recursive: true })
fs.writeFileSync(out, JSON.stringify({ source: "db_multipos_20261001", units, tables }, null, 0))
console.log(report)
console.log("columnas sensibles vaciadas; salida:", out)
