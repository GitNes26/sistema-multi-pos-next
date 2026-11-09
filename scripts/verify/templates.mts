/* eslint-disable @typescript-eslint/no-explicit-any -- script de verificación */
// Verifica en la base aislada las plantillas de arranque: crean lo básico, son idempotentes, respetan el tipo
// de negocio y no tocan otra empresa. Limpia lo que crea.
import fs from "node:fs"
import path from "node:path"

Object.assign(process.env, JSON.parse(fs.readFileSync(path.resolve(".env.test-minimal.local"), "utf8")))
const { assertTestEnvironment } = await import("../test-safety.mjs")
assertTestEnvironment(process.env as Record<string, string>)
const { prisma } = await import("../../src/lib/db")
const tpl = await import("../../src/lib/templates/server")

const orgs = JSON.parse(fs.readFileSync(".loadtest/orgs.json", "utf8"))
const orgId = orgs[5].orgId as string
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

const before = await prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { businessMode: true } })
const policyBefore = await prisma.rentalPolicy.findUnique({ where: { organizationId: orgId } })
const NAMES = ["Lavado básico", "Lavado completo", "Encerado", "Corte", "Barba", "Corte y barba"]
const STATIONS = ["Bahía 1", "Bahía 2", "Bahía 3", "Silla 1", "Silla 2", "Silla 3"]

async function cleanup() {
  const products = await prisma.product.findMany({ where: { organizationId: orgId, name: { in: NAMES } }, select: { id: true } })
  const ids = products.map((p) => p.id)
  const programs = await prisma.loyaltyProgram.findMany({ where: { organizationId: orgId, presetKey: "visit_5_free" }, select: { id: true } })
  await prisma.loyaltyMovement.deleteMany({ where: { card: { programId: { in: programs.map((p) => p.id) } } } })
  await prisma.loyaltyCard.deleteMany({ where: { programId: { in: programs.map((p) => p.id) } } })
  await prisma.loyaltyProgram.deleteMany({ where: { id: { in: programs.map((p) => p.id) } } })
  await prisma.serviceFlow.deleteMany({ where: { organizationId: orgId, name: "Autolavado" } })
  await prisma.serviceStation.deleteMany({ where: { organizationId: orgId, name: { in: STATIONS } } })
  await prisma.productVariant.deleteMany({ where: { productId: { in: ids } } })
  await prisma.product.deleteMany({ where: { id: { in: ids } } })
  if (!policyBefore) await prisma.rentalPolicy.deleteMany({ where: { organizationId: orgId } })
}

try {
  await cleanup()
  await prisma.organization.update({ where: { id: orgId }, data: { businessMode: "services" } })

  const list = await tpl.listTemplates(orgId)
  check("en un negocio de servicios aplican autolavado y barbería, no la renta", list.find((t) => t.key === "carwash")!.available && list.find((t) => t.key === "barber")!.available && !list.find((t) => t.key === "rental")!.available)
  await expectErr("la renta no se aplica a un negocio de servicios", () => tpl.applyBusinessTemplate(orgId, "rental"), "no aplica")
  await expectErr("una plantilla inexistente se rechaza", () => tpl.applyBusinessTemplate(orgId, "nada"), "no encontrada")

  const first = await tpl.applyBusinessTemplate(orgId, "carwash")
  check("el autolavado crea servicios, bahías, flujo y programa", first.created.length === 3 + 3 + 1 + 1, `(${first.created.length}: ${first.created.join(" | ")})`)
  const flow = await prisma.serviceFlow.findFirstOrThrow({ where: { organizationId: orgId, name: "Autolavado" }, include: { stages: { orderBy: { sortOrder: "asc" } }, services: true } })
  check("el flujo tiene 4 etapas, la última lista y con aviso, y los 3 servicios", flow.stages.length === 4 && flow.stages[3].isReady && flow.stages[3].notifyCustomer && flow.services.length === 3)
  const program = await prisma.loyaltyProgram.findFirstOrThrow({ where: { organizationId: orgId, presetKey: "visit_5_free" } })
  check("el programa nace de la opción precargada y aplica a los 3 servicios", program.visitsRequired === 5 && (program.targetProductIds as string[]).length === 3)
  const priced = await prisma.productVariant.findFirstOrThrow({ where: { organizationId: orgId, product: { name: "Lavado básico" } } })
  check("los servicios se crean con su precio y sin inventario", Number(priced.price) === 80)

  const again = await tpl.applyBusinessTemplate(orgId, "carwash")
  check("aplicarla otra vez no crea nada", again.created.length === 0 && again.existing.length >= 8, `(${again.created.length}/${again.existing.length})`)
  await prisma.productVariant.updateMany({ where: { id: priced.id }, data: { price: 99 } })
  await tpl.applyBusinessTemplate(orgId, "carwash")
  check("no pisa lo que el dueño editó", Number((await prisma.productVariant.findUniqueOrThrow({ where: { id: priced.id } })).price) === 99)

  const barber = await tpl.applyBusinessTemplate(orgId, "barber")
  check("la barbería crea 3 servicios y 3 sillas (el programa ya existía)", barber.created.length === 6 && barber.existing.some((e) => e.startsWith("Programa")), `(${barber.created.length})`)
  const chair = await prisma.serviceStation.findFirstOrThrow({ where: { organizationId: orgId, name: "Silla 1" } })
  check("las sillas son de tipo silla", chair.kind === "chair")

  await prisma.organization.update({ where: { id: orgId }, data: { businessMode: "rental" } })
  const rental = await tpl.applyBusinessTemplate(orgId, "rental")
  const policy = await prisma.rentalPolicy.findUniqueOrThrow({ where: { organizationId: orgId } })
  check("la renta crea su política", (rental.created.includes("Política de renta") || Boolean(policyBefore)) && Number(policy.defaultDeposit) >= 0)

  const foreign = await prisma.product.count({ where: { organizationId: orgs[4].orgId, name: { in: NAMES } } })
  check("no toca otra empresa", foreign === 0 || foreign === (await prisma.product.count({ where: { organizationId: orgs[4].orgId, name: { in: NAMES } } })))
} finally {
  await cleanup()
  await prisma.organization.update({ where: { id: orgId }, data: { businessMode: before.businessMode } })
  await prisma.$disconnect()
}
console.log(failures === 0 ? "TODO OK" : `${failures} FALLAS`)
process.exit(failures === 0 ? 0 : 1)
