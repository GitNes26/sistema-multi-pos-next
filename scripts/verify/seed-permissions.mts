/* eslint-disable @typescript-eslint/no-explicit-any -- script de verificación */
// Verifica en la base aislada que el seeder crea los permisos de verticales, los asigna a los roles
// capaces de cumplir esas actividades, respalda planes y roles propios, y es idempotente.
import fs from "node:fs"
import path from "node:path"

Object.assign(process.env, JSON.parse(fs.readFileSync(path.resolve(".env.test-minimal.local"), "utf8")))
process.env.SEED_NESSIK_TEST = "false"
const { assertTestEnvironment } = await import("../test-safety.mjs")
assertTestEnvironment(process.env as Record<string, string>)
const { prisma } = await import("../../src/lib/db")
const { seedProduction } = await import("../../prisma/seeders/production")

let failures = 0
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "OK  " : "FALLA"} ${name} ${extra}`)
  if (!ok) failures += 1
}
const NEW = ["appointments.checkin", "appointments.override", "appointments.policy", "assets.view", "assets.manage", "stations.view", "stations.manage", "service_orders.view", "service_orders.manage", "service_flows.manage"]

// Una empresa con un plan de lista guardada y un rol propio que ya hacía lo equivalente.
const org = await prisma.organization.findFirstOrThrow({ select: { id: true } })
const customRole = await prisma.role.create({ data: { name: "zz-rol-propio", description: "prueba", isSystem: false, organizationId: org.id } as any })
await prisma.rolePermission.createMany({ data: [{ roleId: customRole.id, organizationId: org.id, permissionKey: "customers.manage", allowed: true }, { roleId: customRole.id, organizationId: org.id, permissionKey: "appointments.manage", allowed: true }] })
const plan = await prisma.subscriptionPlan.create({ data: { name: "zz-plan-prueba", description: "x", monthlyPrice: 0, permissions: ["pos.use", "products.view"] } as any })

// Se simula una base anterior: sin los permisos nuevos.
await prisma.rolePermission.deleteMany({ where: { permissionKey: { in: NEW } } })
await prisma.permission.deleteMany({ where: { key: { in: NEW } } })

try {
  await seedProduction()
  const perms = await prisma.permission.findMany({ where: { key: { in: NEW } } })
  check("los 10 permisos nuevos existen", perms.length === 10, String(perms.length))

  const has = async (roleName: string, key: string) => (await prisma.rolePermission.count({ where: { permissionKey: key, allowed: true, role: { name: roleName, isSystem: true } } })) > 0
  check("Propietario tiene todos", (await Promise.all(NEW.map((k) => has("Propietario", k)))).every(Boolean))
  check("Gerente tiene todos", (await Promise.all(NEW.map((k) => has("Gerente", k)))).every(Boolean))
  check("Cajero registra vehículos y opera órdenes", (await has("Cajero", "assets.manage")) && (await has("Cajero", "service_orders.manage")) && (await has("Cajero", "stations.view")))
  check("Cajero NO configura política ni se salta reglas", !(await has("Cajero", "appointments.policy")) && !(await has("Cajero", "appointments.override")))
  check("Agente de atención registra llegada", await has("Agente de atención", "appointments.checkin"))
  check("Agente de atención NO se salta la política", !(await has("Agente de atención", "appointments.override")))
  check("Trabajador completo opera órdenes y llegada", (await has("Trabajador completo", "service_orders.manage")) && (await has("Trabajador completo", "appointments.checkin")))
  check("Mesero y Repartidor no reciben permisos de verticales", !(await has("Mesero", "assets.view")) && !(await has("Repartidor", "assets.view")))

  const rp = await prisma.rolePermission.findMany({ where: { roleId: customRole.id }, select: { permissionKey: true } })
  const keys = rp.map((r: any) => r.permissionKey)
  check("rol propio con customers.manage conserva vehículos", keys.includes("assets.manage"))
  check("rol propio con appointments.manage conserva llegada", keys.includes("appointments.checkin"))
  const planRow = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { id: plan.id } })
  check("plan con lista guardada incluye los permisos nuevos", NEW.every((k) => (planRow.permissions as string[]).includes(k)))
  const menus = await prisma.menu.findMany({ where: { id: { in: ["menu-vehiculos", "menu-bahias", "menu-ordenes-servicio"] } }, select: { id: true, permissionKey: true } })
  check("menús nuevos con su permiso propio", menus.length === 3 && menus.some((m: any) => m.permissionKey === "service_orders.view") && menus.some((m: any) => m.permissionKey === "assets.view") && menus.some((m: any) => m.permissionKey === "stations.view"))

  const before = await prisma.rolePermission.count()
  await seedProduction()
  const after = await prisma.rolePermission.count()
  check("el seeder es idempotente (segunda corrida sin duplicados)", before === after, `${before} → ${after}`)
} finally {
  await prisma.rolePermission.deleteMany({ where: { roleId: customRole.id } })
  await prisma.role.delete({ where: { id: customRole.id } })
  await prisma.subscriptionPlan.delete({ where: { id: plan.id } })
  await prisma.$disconnect()
}
console.log(failures === 0 ? "TODO OK" : `${failures} FALLAS`)
process.exit(failures === 0 ? 0 : 1)
