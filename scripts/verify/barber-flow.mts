/* eslint-disable @typescript-eslint/no-explicit-any -- script de verificación */
// Verifica en la base aislada el flujo de barbería: ficha de estilo con indicaciones del corte, cita en una silla,
// «Llegó» y paso de la cita a una orden de servicio (con las indicaciones), una sola orden por cita, la cita no se
// cobra aparte, y al cobrar la orden la cita queda completada con la misma venta. Limpia lo que crea.
import fs from "node:fs"
import path from "node:path"

Object.assign(process.env, JSON.parse(fs.readFileSync(path.resolve(".env.test-minimal.local"), "utf8")))
const { assertTestEnvironment } = await import("../test-safety.mjs")
assertTestEnvironment(process.env as Record<string, string>)
const { prisma } = await import("../../src/lib/db")
const so = await import("../../src/lib/service-orders/server")
const ag = await import("../../src/lib/agenda/server")
const pos = await import("../../src/lib/pos/server")
const { assetsModule } = await import("../../src/lib/crud/modules/assets")

const orgs = JSON.parse(fs.readFileSync(".loadtest/orgs.json", "utf8"))
const orgId = orgs[5].orgId as string
const user = await prisma.user.findFirstOrThrow({ select: { id: true } })
const location = await prisma.location.findFirstOrThrow({ where: { organizationId: orgId }, orderBy: { createdAt: "asc" } })
const register = await prisma.cashRegister.findFirstOrThrow({ where: { organizationId: orgId, locationId: location.id } })

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

const created = { product: "", customer: "", employee: "", station: "", asset: "", appointment: "", session: "", sale: "" }
try {
  // Restos de una corrida interrumpida (todo lo que crea esta prueba lleva el prefijo «zz»).
  const staleAppts = await prisma.appointment.findMany({ where: { organizationId: orgId, notes: "Llega con prisa" }, select: { id: true } })
  const staleOrders = await prisma.serviceOrder.findMany({ where: { organizationId: orgId, OR: [{ appointmentId: { in: staleAppts.map((a) => a.id) } }, { items: { some: { productName: "zz Corte clásico" } } }] }, select: { id: true, saleId: true } })
  const oids = staleOrders.map((o) => o.id)
  await prisma.serviceOrderEvent.deleteMany({ where: { orderId: { in: oids } } })
  await prisma.serviceOrderItem.deleteMany({ where: { orderId: { in: oids } } })
  await prisma.checklistRun.deleteMany({ where: { organizationId: orgId, subjectId: { in: oids } } })
  await prisma.serviceOrder.deleteMany({ where: { id: { in: oids } } })
  await prisma.appointmentEvent.deleteMany({ where: { appointmentId: { in: staleAppts.map((a) => a.id) } } })
  await prisma.appointment.updateMany({ where: { id: { in: staleAppts.map((a) => a.id) } }, data: { saleId: null } })
  await prisma.appointment.deleteMany({ where: { id: { in: staleAppts.map((a) => a.id) } } })
  const staleSales = await prisma.sale.findMany({ where: { organizationId: orgId, items: { some: { productName: "zz Corte clásico" } } }, select: { id: true } })
  for (const sale of staleSales) {
    await prisma.salePayment.deleteMany({ where: { saleId: sale.id } })
    await prisma.saleItem.deleteMany({ where: { saleId: sale.id } })
    await prisma.sale.delete({ where: { id: sale.id } }).catch(() => undefined)
  }
  await prisma.customerAsset.deleteMany({ where: { organizationId: orgId, label: "zz Corte de Juan" } })
  const staleProducts = await prisma.product.findMany({ where: { organizationId: orgId, name: "zz Corte clásico" }, select: { id: true } })
  await prisma.productVariant.deleteMany({ where: { productId: { in: staleProducts.map((p) => p.id) } } })
  await prisma.product.deleteMany({ where: { id: { in: staleProducts.map((p) => p.id) } } })
  await prisma.serviceStation.deleteMany({ where: { organizationId: orgId, name: "zz Silla 1" } })
  await prisma.employee.deleteMany({ where: { organizationId: orgId, fullName: "zz Barbero" } })
  const alreadyOpen = await prisma.cashSession.findFirst({ where: { organizationId: orgId, cashRegister: { locationId: location.id }, status: "open" } })
  let sessionId: string
  if (alreadyOpen) sessionId = alreadyOpen.id
  else {
    const opened = await pos.openCashSession(orgId, location.id, register.id, 100, user.id)
    sessionId = (opened.session as any).id
    created.session = sessionId
  }

  const product = await prisma.product.create({
    data: { organizationId: orgId, name: "zz Corte clásico", trackInventory: false, variants: { create: { organizationId: orgId, name: "Default", price: 150 } } },
    include: { variants: true },
  })
  created.product = product.id
  const variantId = product.variants[0].id
  // Un cliente existente de la empresa de pruebas (no se crea ni se borra).
  const customer = await prisma.customer.findFirstOrThrow({ where: { organizationId: orgId } })
  let employee = await prisma.employee.findFirst({ where: { organizationId: orgId } })
  if (!employee) {
    employee = await prisma.employee.create({ data: { organizationId: orgId, userId: user.id, fullName: "zz Barbero" } })
    created.employee = employee.id
  }
  const station = await prisma.serviceStation.create({ data: { organizationId: orgId, locationId: location.id, name: "zz Silla 1", kind: "chair" } })
  created.station = station.id

  // Ficha de estilo con indicaciones estructuradas
  const asset: any = await assetsModule.create(orgId, { customerId: customer.id, kind: "profile", label: "zz Corte de Juan", cutSides: "degradado bajo", cutBeard: "perfilada 2 mm", notes: "Sensible en la nuca" } as any)
  created.asset = asset.id
  check("la ficha guarda las indicaciones del corte", asset.cutSides === "degradado bajo" && asset.cutBeard === "perfilada 2 mm" && asset.cutTop === null, `(${asset.cutSides}/${asset.cutBeard}/${asset.cutTop})`)
  const edited: any = await assetsModule.update(orgId, asset.id, { cutSides: "", cutTop: "4 cm" } as any)
  check("al editar se conservan las demás y se limpia la vacía", edited.cutSides === null && edited.cutTop === "4 cm" && edited.cutBeard === "perfilada 2 mm")

  // Cita en la silla
  const startsAt = new Date(Date.now() + 5 * 60_000)
  const appt = await prisma.appointment.create({
    data: {
      organizationId: orgId, locationId: location.id, customerId: customer.id, employeeId: employee.id, variantId, status: "confirmed",
      startsAt, endsAt: new Date(startsAt.getTime() + 30 * 60_000), durationMin: 30, notes: "Llega con prisa", stationId: station.id, assetId: asset.id,
    },
  })
  created.appointment = appt.id

  await expectErr("sin «Llegó» no se pasa a orden", () => so.startOrderFromAppointment(orgId, appt.id, user.id), "llegada")
  await ag.checkInAppointment(orgId, appt.id, { actorUserId: user.id })
  const order = await so.startOrderFromAppointment(orgId, appt.id, user.id)
  check("la orden toma silla, empleado y el vehículo/ficha de la cita", order.station?.id === station.id && order.employee?.id === employee.id && order.asset?.id === asset.id)
  const row = await prisma.serviceOrder.findUniqueOrThrow({ where: { id: order.id } })
  check("las indicaciones incluyen la ficha de estilo y las notas", /Parte superior: 4 cm/.test(row.indications ?? "") && /Barba y bigote: perfilada 2 mm/.test(row.indications ?? "") && /Sensible en la nuca/.test(row.indications ?? "") && /Llega con prisa/.test(row.indications ?? ""), `(${row.indications?.replace(/\n/g, " | ")})`)
  check("la orden queda ligada a la cita", row.appointmentId === appt.id)
  await expectErr("una cita no genera dos órdenes", () => so.startOrderFromAppointment(orgId, appt.id, user.id), "ya tiene la orden")
  await expectErr("la cita con orden no se cobra aparte", () => ag.checkoutAppointment(orgId, appt.id, "cash", { userId: user.id, employeeId: null }), "orden de servicio")

  // Avanza la orden hasta listo y cóbrala
  const flow = await prisma.serviceFlowStage.findMany({ where: { flowId: row.flowId, isActive: true }, orderBy: { sortOrder: "asc" } })
  const ready = flow.find((s) => s.isReady)!
  await prisma.serviceOrder.update({ where: { id: order.id }, data: { stageId: ready.id, status: "ready", readyAt: new Date() } })
  const paid = await so.checkoutServiceOrder(orgId, order.id, "cash", { userId: user.id, employeeId: null })
  created.sale = paid.saleId
  const after = await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })
  check("al cobrar la orden la cita queda completada con la misma venta", after.status === "completed" && after.saleId === paid.saleId)
} finally {
  if (created.appointment) await prisma.appointmentEvent.deleteMany({ where: { appointmentId: created.appointment } })
  if (created.appointment) {
    const orders = await prisma.serviceOrder.findMany({ where: { appointmentId: created.appointment }, select: { id: true } })
    const ids = orders.map((o) => o.id)
    await prisma.serviceOrderEvent.deleteMany({ where: { orderId: { in: ids } } })
    await prisma.serviceOrderItem.deleteMany({ where: { orderId: { in: ids } } })
    await prisma.checklistRun.deleteMany({ where: { organizationId: orgId, subjectId: { in: ids } } })
    await prisma.serviceOrder.deleteMany({ where: { id: { in: ids } } })
    await prisma.appointment.delete({ where: { id: created.appointment } })
  }
  if (created.sale) {
    await prisma.salePayment.deleteMany({ where: { saleId: created.sale } })
    await prisma.saleItem.deleteMany({ where: { saleId: created.sale } })
    await prisma.sale.delete({ where: { id: created.sale } }).catch(() => undefined)
  }
  if (created.employee) await prisma.employee.delete({ where: { id: created.employee } }).catch(() => undefined)
  if (created.asset) await prisma.customerAsset.delete({ where: { id: created.asset } })
  if (created.station) await prisma.serviceStation.delete({ where: { id: created.station } })
  if (created.product) {
    await prisma.productVariant.deleteMany({ where: { productId: created.product } })
    await prisma.product.delete({ where: { id: created.product } }).catch(() => undefined)
  }
  if (created.session) await prisma.cashSession.delete({ where: { id: created.session } }).catch(() => undefined)
  await prisma.$disconnect()
}
console.log(failures === 0 ? "TODO OK" : `${failures} FALLAS`)
process.exit(failures === 0 ? 0 : 1)
