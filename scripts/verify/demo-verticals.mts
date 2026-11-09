/* eslint-disable @typescript-eslint/no-explicit-any -- script de verificación */
// Verifica en la base demo AISLADA que los datos demo de verticales existen, son idempotentes y coherentes.
//   npx tsx scripts/verify/demo-verticals.mts   (usa .env.test-demo.local)
import fs from "node:fs"
import path from "node:path"

Object.assign(process.env, JSON.parse(fs.readFileSync(path.resolve(".env.test-demo.local"), "utf8")))
const { assertTestEnvironment } = await import("../test-safety.mjs")
assertTestEnvironment(process.env as Record<string, string>)
const { prisma } = await import("../../src/lib/db")
const { seedVerticalsDemo } = await import("../../prisma/seeders/demo-verticals")
const loyalty = await import("../../src/lib/loyalty/server")
const warranty = await import("../../src/lib/warranty/server")

let failures = 0
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "OK  " : "FALLA"} ${name} ${extra}`)
  if (!ok) failures += 1
}

const first = await seedVerticalsDemo()
check("existe «Híbrido Demo»", Boolean(first.organizationId))
const orgId = first.organizationId!
const second = await seedVerticalsDemo()
check("sembrarlo otra vez no crea nada (idempotente)", second.created.length === 0, `(${second.created.join(" | ")})`)

const stations = await prisma.serviceStation.count({ where: { organizationId: orgId, name: { in: ["Bahía 1", "Bahía 2", "Bahía 3", "Silla 1", "Silla 2", "Silla 3"] } } })
check("hay bahías y sillas", stations === 6, `(${stations})`)
check("hay flujo de autolavado con 4 etapas", (await prisma.serviceFlow.findFirst({ where: { organizationId: orgId, name: "Autolavado" }, include: { stages: true } }))?.stages.length === 4)
check("hay política de renta", Boolean(await prisma.rentalPolicy.findUnique({ where: { organizationId: orgId } })))

const programs = await loyalty.listLoyaltyPrograms(orgId)
const membership = programs.find((p) => p.kind === "membership")
check("hay una membresía con cuota y 4 servicios por periodo", Boolean(membership) && membership!.packUses === 4 && membership!.packProductName === "Membresía mensual de lavados" && membership!.periodDays === 30, `(${membership?.name})`)
check("hay una tarjeta de visitas", programs.some((p) => p.kind === "visit_card"))
check("la membresía tiene un miembro vigente", (membership?.activeMembers ?? 0) >= 1)

const rules = await warranty.listWarrantyRules(orgId)
check("hay una garantía de lluvia el mismo día, activa", rules.some((r) => r.presetKey === "rain_same_day" && r.isActive && r.sameDayOnly && r.coversProductNames.includes("Lavado básico")))

const customer = await prisma.customer.findFirst({ where: { organizationId: orgId, user: { email: "hcli-001@hibrido.local" } }, select: { id: true } })
const mine = customer ? (await loyalty.getCustomerLoyalty(orgId, customer.id)).find((x) => x.programId === membership?.id) : null
check("el cliente demo ve su membresía vigente con 3 servicios", mine?.membership?.status === "active" && mine.credits === 3 && (mine.membership.daysLeft ?? 0) > 15, `(${mine?.membership?.status}/${mine?.credits})`)

await prisma.$disconnect()
console.log(failures === 0 ? "TODO OK" : `${failures} FALLAS`)
process.exit(failures === 0 ? 0 : 1)
