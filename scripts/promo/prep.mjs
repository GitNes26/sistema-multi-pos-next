// Prepara la base de pruebas antes de grabar:  node scripts/promo/prep.mjs <correo> <empresa> [--cerrar-caja]
// Fija la empresa por defecto del usuario (lastOrganizationId) y, si se pide, cierra las cajas abiertas de esa empresa.
import fs from "node:fs"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const env = JSON.parse(fs.readFileSync(".env.test-demo.local", "utf8"))
const { PrismaClient } = require("@prisma/client")
const db = new PrismaClient({ datasourceUrl: env.DATABASE_URL })
const [email, orgName, flag] = process.argv.slice(2)
const org = await db.organization.findFirst({ where: { name: { contains: orgName } } })
if (!org) throw new Error("empresa no encontrada: " + orgName)
await db.user.update({ where: { email }, data: { lastOrganizationId: org.id } })
if (flag === "--cerrar-caja") {
  const r = await db.cashSession.updateMany({ where: { organizationId: org.id, status: "open" }, data: { status: "closed", closedAt: new Date() } })
  console.log("cajas cerradas:", r.count)
}
console.log("ok", email, "->", org.name)
await db.$disconnect()
