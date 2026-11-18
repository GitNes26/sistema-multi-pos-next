// Prepara el autolavado de demostración en «Híbrido Demo» (base de pruebas): personal con servicios, horarios y un vehículo del cliente.
import fs from "node:fs"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const env = JSON.parse(fs.readFileSync(".env.test-demo.local", "utf8"))
const { PrismaClient } = require("@prisma/client")
const db = new PrismaClient({ datasourceUrl: env.DATABASE_URL })
const org = await db.organization.findFirst({ where: { name: "Híbrido Demo" } })
if (process.argv.includes("--limpiar")) {
  const w = { organizationId: org.id }
  const orders = await db.serviceOrder.findMany({ where: w, select: { id: true } })
  const ids = orders.map((o) => o.id)
  await db.serviceOrderEvent.deleteMany({ where: { orderId: { in: ids } } }).catch((e) => console.log("ev", e.message.slice(0, 80)))
  await db.serviceOrderItem.deleteMany({ where: { orderId: { in: ids } } }).catch((e) => console.log("it", e.message.slice(0, 80)))
  await db.serviceOrder.deleteMany({ where: w }).catch((e) => console.log("so", e.message.slice(0, 80)))
  const appts = await db.appointment.findMany({ where: w, select: { id: true } })
  await db.appointmentEvent.deleteMany({ where: { appointmentId: { in: appts.map((a) => a.id) } } }).catch((e) => console.log("ae", e.message.slice(0, 80)))
  await db.appointment.deleteMany({ where: w }).catch((e) => console.log("ap", e.message.slice(0, 80)))
  console.log("órdenes y citas borradas:", ids.length, appts.length)
}
const employees = await db.employee.findMany({ where: { organizationId: org.id, isActive: true }, take: 3, orderBy: { createdAt: "asc" } })
console.log("empleados:", employees.map((e) => e.fullName))
const wash = [["Lavado básico", 30], ["Lavado completo", 60], ["Encerado", 90]]
for (const e of employees) {
  await db.employee.update({ where: { id: e.id }, data: { workDays: [1, 2, 3, 4, 5, 6], shiftStart: "09:00", shiftEnd: "18:00" } })
  for (const [name, durationMin] of wash) {
    const v = await db.productVariant.findFirst({ where: { organizationId: org.id, product: { name } } })
    if (!v) { console.log("sin variante", name); continue }
    await db.employeeService.upsert({ where: { employeeId_variantId: { employeeId: e.id, variantId: v.id } }, update: { durationMin, isActive: true }, create: { organizationId: org.id, employeeId: e.id, variantId: v.id, durationMin } })
  }
}
const u = await db.user.findFirst({ where: { email: "hcli-001@hibrido.local" } })
const c = await db.customer.findFirst({ where: { organizationId: org.id, userId: u.id } })
if (!(await db.customerAsset.findFirst({ where: { customerId: c.id } }))) {
  await db.customerAsset.create({ data: { organizationId: org.id, customerId: c.id, kind: "vehicle", label: "Nissan Versa gris", reference: "ABC-123-D", brand: "Nissan", model: "Versa", color: "Gris", size: "mediano" } })
  console.log("vehículo creado")
}
console.log("ok")
await db.$disconnect()
