/* eslint-disable @typescript-eslint/no-explicit-any -- script de apoyo para pruebas manuales de pantalla */
// Prepara (up) o retira (down) datos de prueba en la base AISLADA para revisar las pantallas de servicios:
// convierte una empresa de la base de carga en «services», crea servicios con tamaños, bahías y un cliente con
// vehículo, e imprime las cookies de sesión (dueño y cliente del portal) firmadas con el secreto de pruebas.
//   npx tsx scripts/verify/ui-fixture.mts up|down
import fs from "node:fs"
import path from "node:path"

Object.assign(process.env, JSON.parse(fs.readFileSync(path.resolve(".env.test-minimal.local"), "utf8")))
const { assertTestEnvironment } = await import("../test-safety.mjs")
assertTestEnvironment(process.env as Record<string, string>)
const { prisma } = await import("../../src/lib/db")
const { encode } = await import("next-auth/jwt")
const { permissionsForRole } = await import("../../src/lib/auth/server-permissions")

const mode = process.argv[2]
const orgs = JSON.parse(fs.readFileSync(".loadtest/orgs.json", "utf8"))
const o = orgs[6]
const statePath = ".loadtest/ui-fixture.json"

if (mode === "up") {
  const loc = await prisma.location.findFirstOrThrow({ where: { organizationId: o.orgId }, orderBy: { createdAt: "asc" } })
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: o.orgId }, select: { businessMode: true } })
  const week = JSON.stringify(Array.from({ length: 7 }, (_, d) => ({ day: d, enabled: true, slots: [{ open: "08:00", close: "20:00" }] })))
  const state: any = { orgId: o.orgId, oldMode: org.businessMode, locationId: loc.id, oldSchedule: loc.openingScheduleJson, products: [], stations: [], assets: [] }
  await prisma.organization.update({ where: { id: o.orgId }, data: { businessMode: "services" } })
  await prisma.location.update({ where: { id: loc.id }, data: { openingScheduleJson: week } })
  const mk = async (name: string, variants: [string, number][]) => {
    const p = await prisma.product.create({ data: { organizationId: o.orgId, name, trackInventory: false, variants: { create: variants.map(([vn, price]) => ({ organizationId: o.orgId, name: vn, price })) } } })
    state.products.push(p.id)
  }
  await mk("Lavado exterior", [["chico", 80], ["mediano", 100], ["camioneta", 130]])
  await mk("Lavado completo", [["chico", 150], ["mediano", 180], ["camioneta", 230]])
  await mk("Cera", [["Default", 60]])
  for (const name of ["Bahía 1", "Bahía 2", "Carril 3"]) state.stations.push((await prisma.serviceStation.create({ data: { organizationId: o.orgId, locationId: loc.id, name, kind: name.startsWith("Carril") ? "lane" : "bay" } })).id)
  const asset = await prisma.customerAsset.create({ data: { organizationId: o.orgId, customerId: o.customerId, label: "Tsuru gris", reference: "ABC-123", size: "mediano" } })
  state.assets.push(asset.id)
  fs.writeFileSync(statePath, JSON.stringify(state))

  const secret = process.env.NEXTAUTH_SECRET!
  const perms = await permissionsForRole("owner", null, o.orgId)
  const cookie = async (kind: "app" | "portal") => {
    const id = kind === "app" ? o.ownerId : o.customerUserId
    return encode({
      secret,
      maxAge: 60 * 60 * 6,
      token: {
        sub: id, id, name: kind === "app" ? "Dueño de prueba" : "Cliente de prueba", email: `${id}@load.test`,
        role: kind === "app" ? "owner" : "customer", roleName: null,
        organizationId: o.orgId, activeOrganizationId: o.orgId, organizationName: "Negocio de prueba",
        businessMode: "services", permissions: kind === "app" ? perms : [], planDenied: [],
        scope: kind, authCheckedAt: Date.now(), authVersion: 0,
      },
    })
  }
  fs.writeFileSync(".loadtest/ui-cookies.json", JSON.stringify({ app: await cookie("app"), portal: await cookie("portal") }))
  console.log("fixture lista")
} else if (mode === "down") {
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"))
  const org = state.orgId
  const orders = (await prisma.serviceOrder.findMany({ where: { organizationId: org }, select: { id: true } })).map((x: any) => x.id)
  await prisma.checklistRunItem.deleteMany({ where: { run: { organizationId: org } } })
  await prisma.checklistRun.deleteMany({ where: { organizationId: org } })
  await prisma.checklistTemplateItem.deleteMany({ where: { template: { organizationId: org } } })
  await prisma.checklistTemplate.deleteMany({ where: { organizationId: org } })
  await prisma.serviceOrderEvent.deleteMany({ where: { orderId: { in: orders } } })
  await prisma.serviceOrderItem.deleteMany({ where: { orderId: { in: orders } } })
  const sales = (await prisma.serviceOrder.findMany({ where: { organizationId: org, saleId: { not: null } }, select: { saleId: true } })).map((x: any) => x.saleId)
  await prisma.serviceOrder.updateMany({ where: { organizationId: org }, data: { saleId: null } })
  await prisma.serviceOrder.deleteMany({ where: { organizationId: org } })
  for (const saleId of sales) {
    await prisma.loyaltyTransaction.deleteMany({ where: { saleId } }).catch(() => undefined)
    await prisma.salePayment.deleteMany({ where: { saleId } }).catch(() => undefined)
    await prisma.saleItem.deleteMany({ where: { saleId } }).catch(() => undefined)
    await prisma.sale.delete({ where: { id: saleId } }).catch(() => undefined)
  }
  const flows = (await prisma.serviceFlow.findMany({ where: { organizationId: org }, select: { id: true } })).map((x: any) => x.id)
  await prisma.serviceFlowService.deleteMany({ where: { flowId: { in: flows } } })
  await prisma.serviceFlowStage.deleteMany({ where: { flowId: { in: flows } } })
  await prisma.serviceFlow.deleteMany({ where: { id: { in: flows } } })
  await prisma.customerAsset.deleteMany({ where: { organizationId: org } })
  await prisma.serviceStation.deleteMany({ where: { organizationId: org } })
  await prisma.productVariant.deleteMany({ where: { productId: { in: state.products } } })
  await prisma.product.deleteMany({ where: { id: { in: state.products } } })
  await prisma.location.update({ where: { id: state.locationId }, data: { openingScheduleJson: state.oldSchedule } })
  await prisma.organization.update({ where: { id: org }, data: { businessMode: state.oldMode } })
  fs.rmSync(statePath, { force: true })
  fs.rmSync(".loadtest/ui-cookies.json", { force: true })
  console.log("fixture retirada")
} else {
  console.log("uso: up | down")
}
await prisma.$disconnect()
