/* eslint-disable @typescript-eslint/no-explicit-any -- script de verificación */
// Verifica en la base aislada el motor de órdenes de servicio: flujos, ingreso, llavero y lugar únicos,
// etapas, aviso al cliente, cobro con UNA venta ligada y cancelación. Limpia lo que crea.
import fs from "node:fs"
import path from "node:path"

Object.assign(process.env, JSON.parse(fs.readFileSync(path.resolve(".env.test-minimal.local"), "utf8")))
const { assertTestEnvironment } = await import("../test-safety.mjs")
assertTestEnvironment(process.env as Record<string, string>)
const { prisma } = await import("../../src/lib/db")
const so = await import("../../src/lib/service-orders/server")
const portal = await import("../../src/lib/service-orders/portal")

const orgs = JSON.parse(fs.readFileSync(".loadtest/orgs.json", "utf8"))
const orgId = orgs[4].orgId as string
const loc = await prisma.location.findFirstOrThrow({ where: { organizationId: orgId }, orderBy: { createdAt: "asc" } })
const customer = await prisma.customer.findFirstOrThrow({ where: { organizationId: orgId } })
const anyUser = await prisma.user.findFirstOrThrow({ select: { id: true } })

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
    check(name, e instanceof so.ServiceOrderError && String(e.message).toLowerCase().includes(contains.toLowerCase()), `(${e?.message})`)
  }
}

const created = { products: [] as string[], flows: [] as string[], orders: [] as string[], assets: [] as string[], stations: [] as string[], sales: [] as string[] }
const flowsBefore = await prisma.serviceFlow.count({ where: { organizationId: orgId } })

try {
  // Servicios (productos sin inventario) con su precio.
  const mkSvc = async (name: string, price: number, taxRate = 0) => {
    const p = await prisma.product.create({ data: { organizationId: orgId, name, trackInventory: false, taxRate, variants: { create: { organizationId: orgId, name: "Default", price } } }, include: { variants: true } })
    created.products.push(p.id)
    return { productId: p.id, variantId: p.variants[0].id }
  }
  const lavado = await mkSvc("zz Lavado completo", 150)
  const cera = await mkSvc("zz Cera", 80, 0.16)

  // Flujos
  const initial = await so.listFlows(orgId)
  check("sin flujos configurados se crea el de arranque (3 etapas)", initial.some((f) => f.isDefault && f.stages.length === 3 && f.stages[2].isReady))
  await expectErr("un flujo necesita al menos dos etapas", () => so.saveFlow(orgId, { name: "x", stages: [{ label: "Solo una", isReady: true }] }), "al menos dos")
  await expectErr("un flujo necesita una etapa «Listo»", () => so.saveFlow(orgId, { name: "x", stages: [{ label: "A" }, { label: "B" }] }), "listo")
  await expectErr("solo una etapa puede ser «Listo»", () => so.saveFlow(orgId, { name: "x", stages: [{ label: "A", isReady: true }, { label: "B", isReady: true }] }), "solo una")
  const flow = await so.saveFlow(orgId, { name: "zz Lavado completo", stages: [{ label: "Recibido" }, { label: "Lavando" }, { label: "Aspirado" }, { label: "Listo", isReady: true }], productIds: [lavado.productId] })
  created.flows.push(flow.id)
  check("flujo con 4 etapas y servicio ligado", flow.stages.length === 4 && flow.productIds.length === 1 && flow.stages[3].notifyCustomer)

  // Cliente con dos vehículos; lugares
  const car1 = await prisma.customerAsset.create({ data: { organizationId: orgId, customerId: customer.id, label: "Tsuru gris", reference: "ABC-123", size: "mediano" } })
  const car2 = await prisma.customerAsset.create({ data: { organizationId: orgId, customerId: customer.id, label: "Ranger roja", reference: "XYZ-987", size: "camioneta" } })
  created.assets.push(car1.id, car2.id)
  const bay1 = await prisma.serviceStation.create({ data: { organizationId: orgId, locationId: loc.id, name: "zz Bahía 1" } })
  const bay2 = await prisma.serviceStation.create({ data: { organizationId: orgId, locationId: loc.id, name: "zz Bahía 2" } })
  created.stations.push(bay1.id, bay2.id)
  const other = await prisma.customer.findFirst({ where: { organizationId: orgId, id: { not: customer.id } } })

  // Ingreso
  const o1 = await so.createServiceOrder(orgId, { customerId: customer.id, assetId: car1.id, stationId: bay1.id, keyTag: " a-12 ", indications: "Cuidar el rayón", items: [{ variantId: lavado.variantId }, { variantId: cera.variantId, quantity: 2 }], actorUserId: anyUser.id })
  created.orders.push(o1.id)
  check("la orden toma el flujo del servicio y arranca en la primera etapa", o1.flow.id === flow.id && o1.stage.label === "Recibido" && o1.status === "open")
  check("total calculado en servidor (150 + 2×80 = 310)", o1.total === 310, String(o1.total))
  check("llavero normalizado y vehículo ligado", o1.keyTag === "A-12" && o1.asset?.reference === "ABC-123")
  await expectErr("el mismo llavero no se puede usar dos veces", () => so.createServiceOrder(orgId, { customerId: customer.id, assetId: car2.id, keyTag: "A-12", items: [{ variantId: cera.variantId }] }), "llavero")
  await expectErr("una bahía ocupada se rechaza", () => so.createServiceOrder(orgId, { customerId: customer.id, assetId: car2.id, stationId: bay1.id, items: [{ variantId: cera.variantId }] }), "ocupad")
  if (other) await expectErr("el vehículo debe ser del cliente", () => so.createServiceOrder(orgId, { customerId: other.id, assetId: car2.id, items: [{ variantId: cera.variantId }] }), "no pertenece")
  await expectErr("sin servicios se rechaza", () => so.createServiceOrder(orgId, { customerId: customer.id, items: [] }), "al menos un servicio")
  const o2 = await so.createServiceOrder(orgId, { customerId: customer.id, assetId: car2.id, stationId: bay2.id, keyTag: "A-13", items: [{ variantId: cera.variantId }], actorUserId: anyUser.id })
  created.orders.push(o2.id)
  check("el segundo cliente/vehículo recibe el folio siguiente y usa el flujo general", o2.number === o1.number + 1 && o2.flow.id !== flow.id)

  // Etapas
  await expectErr("no se cobra una orden que aún no está lista", () => so.checkoutServiceOrder(orgId, o1.id, "cash", { userId: anyUser.id, employeeId: null }), "aún no está lista")
  const stages = flow.stages
  const moved = await so.updateServiceOrder(orgId, o1.id, { stageId: stages[1].id, actorUserId: anyUser.id })
  check("avanza a Lavando", moved.stage.label === "Lavando" && moved.status === "open")
  const mine = await portal.listPortalOrders(orgId, customer.id)
  const mineO1 = mine.find((o: any) => o.id === o1.id)
  check("el cliente ve su orden con la barra de avance (Recibido listo, Lavando actual)", mineO1?.steps.map((x: any) => x.state).join() === "done,current,todo,todo", mineO1?.steps.map((x: any) => x.state).join())
  if (other) check("otro cliente NO ve esa orden", !(await portal.listPortalOrders(orgId, other.id)).some((o: any) => o.id === o1.id))
  const pa = await portal.createPortalAsset(orgId, customer.id, { label: "Moto azul", reference: "mt-001", size: "chico" })
  created.assets.push(pa.id)
  check("el cliente registra su vehículo (placa en mayúsculas)", pa.reference === "MT-001")
  if (other) {
    const denied = await portal.removePortalAsset(orgId, other.id, pa.id).then(() => false).catch(() => true)
    check("otro cliente no puede quitar mi vehículo", denied)
  }
  await portal.removePortalAsset(orgId, customer.id, pa.id)
  check("el cliente quita su vehículo (se desactiva, no se borra)", (await prisma.customerAsset.findUniqueOrThrow({ where: { id: pa.id } })).isActive === false)
  await expectErr("una etapa de otro flujo se rechaza", () => so.updateServiceOrder(orgId, o1.id, { stageId: initial[0].stages[0].id }), "no pertenece")
  const freed = await so.updateServiceOrder(orgId, o1.id, { stationId: bay2.id }).catch((e: any) => e)
  check("mover a una bahía ocupada se rechaza", freed instanceof so.ServiceOrderError)
  const ready = await so.updateServiceOrder(orgId, o1.id, { stageId: stages[3].id, actorUserId: anyUser.id })
  check("al llegar a «Listo» la orden queda lista", ready.status === "ready" && ready.readyAt !== null)
  check("al quedar lista el vehículo sale de la bahía (queda libre)", ready.station === null)
  const reuse = await so.createServiceOrder(orgId, { customerId: customer.id, assetId: car2.id, stationId: bay1.id, items: [{ variantId: cera.variantId }] }).then((o) => { created.orders.push(o.id); return true }).catch(() => false)
  check("otra orden puede usar esa bahía mientras la primera espera su entrega", reuse)
  await new Promise((r) => setTimeout(r, 600))
  const hist = await so.getServiceOrderHistory(orgId, o1.id)
  check("historial: ingreso, etapas y aviso al cliente", ["created", "stage", "notified"].every((t) => hist.some((e) => e.type === t)), JSON.stringify(hist.map((e) => e.type)))

  // Cobro
  try {
    const paid = await so.checkoutServiceOrder(orgId, o1.id, "cash", { userId: anyUser.id, employeeId: null })
    created.sales.push(paid.saleId)
    const done = await so.getServiceOrder(orgId, o1.id)
    check("el cobro crea UNA venta ligada y entrega la orden", done.status === "delivered" && done.saleId === paid.saleId && done.station === null)
    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: paid.saleId }, include: { items: true } })
    check("la venta lleva las dos partidas con impuesto de la cera (310 + 25.60)", sale.items.length === 2 && Math.abs(Number(sale.total) - 335.6) < 0.01, String(sale.total))
    await expectErr("cobrar dos veces se rechaza", () => so.checkoutServiceOrder(orgId, o1.id, "cash", { userId: anyUser.id, employeeId: null }), "ya fue cobrada")
  } catch (e: any) {
    check("cobro de la orden", false, `(${e?.message})`)
  }

  // Cancelación
  await so.cancelServiceOrder(orgId, o2.id, { reason: "El cliente se fue", actorUserId: anyUser.id })
  const cancelled = await so.getServiceOrder(orgId, o2.id)
  check("cancelar libera el lugar", cancelled.status === "cancelled" && cancelled.station === null)
  await expectErr("una orden cancelada no se mueve", () => so.updateServiceOrder(orgId, o2.id, { stageId: initial[0].stages[1].id }), "cerrada")

  // Editar flujo conservando etapas con órdenes
  const edited = await so.saveFlow(orgId, { id: flow.id, name: "zz Lavado completo", stages: [{ id: stages[0].id, label: "Recibido" }, { id: stages[3].id, label: "Listo", isReady: true }], productIds: [lavado.productId] })
  check("quitar etapas con órdenes no rompe (solo se desactivan)", edited.stages.length === 2)
} finally {
  const orderIds = created.orders
  await prisma.serviceOrderEvent.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.serviceOrderItem.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.serviceOrder.updateMany({ where: { id: { in: orderIds } }, data: { saleId: null } })
  await prisma.serviceOrder.deleteMany({ where: { id: { in: orderIds } } })
  for (const saleId of created.sales) {
    await prisma.loyaltyTransaction.deleteMany({ where: { saleId } }).catch(() => undefined)
    await prisma.salePayment.deleteMany({ where: { saleId } }).catch(() => undefined)
    await prisma.saleItem.deleteMany({ where: { saleId } }).catch(() => undefined)
    await prisma.sale.delete({ where: { id: saleId } }).catch((e: any) => console.log("  (no se pudo borrar la venta de prueba:", e.code, ")"))
  }
  await prisma.serviceFlowService.deleteMany({ where: { flowId: { in: created.flows } } })
  await prisma.serviceFlowStage.deleteMany({ where: { flowId: { in: created.flows } } })
  await prisma.serviceFlow.deleteMany({ where: { id: { in: created.flows } } })
  // El flujo de arranque se crea solo la primera vez; si no existía antes, se retira.
  if (flowsBefore === 0) {
    const auto = await prisma.serviceFlow.findMany({ where: { organizationId: orgId }, select: { id: true } })
    const ids = auto.map((f: any) => f.id)
    await prisma.serviceFlowStage.deleteMany({ where: { flowId: { in: ids } } })
    await prisma.serviceFlow.deleteMany({ where: { id: { in: ids } } })
  }
  await prisma.serviceStation.deleteMany({ where: { id: { in: created.stations } } })
  await prisma.customerAsset.deleteMany({ where: { id: { in: created.assets } } })
  await prisma.productVariant.deleteMany({ where: { productId: { in: created.products } } })
  await prisma.product.deleteMany({ where: { id: { in: created.products } } })
  await prisma.$disconnect()
}
console.log(failures === 0 ? "TODO OK" : `${failures} FALLAS`)
process.exit(failures === 0 ? 0 : 1)
