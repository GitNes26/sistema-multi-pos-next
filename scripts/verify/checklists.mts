/* eslint-disable @typescript-eslint/no-explicit-any -- script de verificación */
// Verifica en la base aislada las listas de revisión: validación de la lista y de cada revisión (puntos
// completos, foto donde se exige), historial por fase y bloqueos (ingreso obligatorio antes de avanzar,
// entrega obligatoria antes de cobrar). Limpia lo que crea.
import fs from "node:fs"
import path from "node:path"

Object.assign(process.env, JSON.parse(fs.readFileSync(path.resolve(".env.test-minimal.local"), "utf8")))
const { assertTestEnvironment } = await import("../test-safety.mjs")
assertTestEnvironment(process.env as Record<string, string>)
const { prisma } = await import("../../src/lib/db")
const so = await import("../../src/lib/service-orders/server")
const cl = await import("../../src/lib/checklists/server")

const orgs = JSON.parse(fs.readFileSync(".loadtest/orgs.json", "utf8"))
const orgId = orgs[5].orgId as string
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
    check(name, String(e.message).toLowerCase().includes(contains.toLowerCase()), `(${e?.message})`)
  }
}

const flowsBefore = await prisma.serviceFlow.count({ where: { organizationId: orgId } })
const created = { product: "", orders: [] as string[], sales: [] as string[] }
try {
  const p = await prisma.product.create({ data: { organizationId: orgId, name: "zz Lavado revisión", trackInventory: false, variants: { create: { organizationId: orgId, name: "Default", price: 100 } } }, include: { variants: true } })
  created.product = p.id
  const variantId = p.variants[0].id

  await expectErr("una fase inválida se rechaza", () => cl.saveTemplate(orgId, { subjectType: "service_order", phase: "otra", items: [{ label: "x" }] }), "fase")
  await expectErr("más de 30 puntos se rechaza", () => cl.saveTemplate(orgId, { subjectType: "service_order", phase: "intake", items: Array.from({ length: 31 }, (_, i) => ({ label: `p${i}` })) }), "30")

  const intake = await cl.saveTemplate(orgId, { subjectType: "service_order", phase: "intake", isRequired: true, items: [{ label: "Rayones" }, { label: "Objetos de valor", requirePhoto: false }, { label: "Tapetes" }] })
  check("lista de ingreso guardada con 3 puntos", intake?.items.length === 3 && intake.isRequired)
  const again = await cl.saveTemplate(orgId, { subjectType: "service_order", phase: "intake", isRequired: true, items: [{ label: "Rayones" }, { label: "Objetos de valor", requirePhoto: false }, { label: "Tapetes" }] })
  check("guardar de nuevo reemplaza (una lista por fase)", (await prisma.checklistTemplate.count({ where: { organizationId: orgId, phase: "intake", subjectType: "service_order" } })) === 1 && again?.items.length === 3)

  const order = await so.createServiceOrder(orgId, { customerId: customer.id, items: [{ variantId }], actorUserId: anyUser.id })
  created.orders.push(order.id)
  const flow = (await so.listFlows(orgId)).find((f) => f.id === order.flow.id)!
  const [, mid, ready] = flow.stages

  // Ingreso obligatorio
  await expectErr("con ingreso obligatorio no se avanza sin revisión", () => so.updateServiceOrder(orgId, order.id, { stageId: mid.id }), "revisión de ingreso")
  await expectErr("la revisión debe incluir todos los puntos", () => cl.saveRun(orgId, { subjectType: "service_order", subjectId: order.id, phase: "intake", items: [{ label: "Rayones", status: "ok" }] }), "falta revisar")
  await expectErr("un problema exige foto", () => cl.saveRun(orgId, { subjectType: "service_order", subjectId: order.id, phase: "intake", items: [{ label: "Rayones", status: "issue", note: "puerta" }, { label: "Objetos de valor", status: "ok" }, { label: "Tapetes", status: "ok" }] }), "foto")
  const run = await cl.saveRun(orgId, {
    subjectType: "service_order",
    subjectId: order.id,
    phase: "intake",
    notes: "Cliente presente",
    actorUserId: anyUser.id,
    items: [
      { label: "Rayones", status: "issue", note: "puerta derecha", photoUrl: "/uploads/prueba.webp" },
      { label: "Objetos de valor", status: "issue", note: "cartera en la guantera" },
      { label: "Tapetes", status: "na" },
    ],
  })
  check("revisión con 2 problemas (foto solo donde se exige)", run.issues === 2)
  const runs = await cl.latestRuns(orgId, "service_order", order.id)
  check("la última revisión de ingreso conserva texto, nota y foto", runs.intake?.items[0].photoUrl === "/uploads/prueba.webp" && runs.intake.items[1].note === "cartera en la guantera" && runs.intake.createdBy !== undefined)
  await so.updateServiceOrder(orgId, order.id, { stageId: mid.id })
  check("con la revisión hecha ya se avanza", (await so.getServiceOrder(orgId, order.id)).stage.id === mid.id)

  // La lista cambia después: la revisión hecha conserva su texto
  await cl.saveTemplate(orgId, { subjectType: "service_order", phase: "intake", items: [{ label: "Cristales" }] })
  const after = await cl.latestRuns(orgId, "service_order", order.id)
  check("cambiar la lista no altera revisiones ya hechas", after.intake.items.map((i) => i.label).join() === "Rayones,Objetos de valor,Tapetes")

  // Entrega obligatoria antes de cobrar
  await cl.saveTemplate(orgId, { subjectType: "service_order", phase: "delivery", isRequired: true, items: [{ label: "Vehículo limpio", requirePhoto: false }] })
  await so.updateServiceOrder(orgId, order.id, { stageId: ready.id })
  await expectErr("con entrega obligatoria no se cobra sin revisión", () => so.checkoutServiceOrder(orgId, order.id, "cash", { userId: anyUser.id, employeeId: null }), "revisión de entrega")
  await cl.saveRun(orgId, { subjectType: "service_order", subjectId: order.id, phase: "delivery", items: [{ label: "Vehículo limpio", status: "ok" }] })
  const paid = await so.checkoutServiceOrder(orgId, order.id, "cash", { userId: anyUser.id, employeeId: null })
  created.sales.push(paid.saleId)
  check("con la revisión de entrega ya se cobra", Boolean(paid.saleId))

  // Quitar la lista (sin puntos) la desactiva
  const gone = await cl.saveTemplate(orgId, { subjectType: "service_order", phase: "delivery", items: [] })
  check("sin puntos la lista se desactiva", gone === null && (await cl.listTemplates(orgId, "service_order")).every((t) => t.phase !== "delivery"))
  check("sin lista no se pide nada", (await cl.missingRequiredChecklist(orgId, "service_order", "otra-orden", "delivery")) === null)
} finally {
  await prisma.checklistRunItem.deleteMany({ where: { run: { organizationId: orgId, subjectId: { in: created.orders } } } })
  await prisma.checklistRun.deleteMany({ where: { organizationId: orgId, subjectId: { in: created.orders } } })
  await prisma.checklistTemplateItem.deleteMany({ where: { template: { organizationId: orgId } } })
  await prisma.checklistTemplate.deleteMany({ where: { organizationId: orgId } })
  await prisma.serviceOrderEvent.deleteMany({ where: { orderId: { in: created.orders } } })
  await prisma.serviceOrderItem.deleteMany({ where: { orderId: { in: created.orders } } })
  await prisma.serviceOrder.updateMany({ where: { id: { in: created.orders } }, data: { saleId: null } })
  await prisma.serviceOrder.deleteMany({ where: { id: { in: created.orders } } })
  for (const saleId of created.sales) {
    await prisma.loyaltyTransaction.deleteMany({ where: { saleId } }).catch(() => undefined)
    await prisma.salePayment.deleteMany({ where: { saleId } }).catch(() => undefined)
    await prisma.saleItem.deleteMany({ where: { saleId } }).catch(() => undefined)
    await prisma.sale.delete({ where: { id: saleId } }).catch(() => undefined)
  }
  if (flowsBefore === 0) {
    const ids = (await prisma.serviceFlow.findMany({ where: { organizationId: orgId }, select: { id: true } })).map((f: any) => f.id)
    await prisma.serviceFlowStage.deleteMany({ where: { flowId: { in: ids } } })
    await prisma.serviceFlow.deleteMany({ where: { id: { in: ids } } })
  }
  if (created.product) {
    await prisma.productVariant.deleteMany({ where: { productId: created.product } })
    await prisma.product.delete({ where: { id: created.product } })
  }
  await prisma.$disconnect()
}
console.log(failures === 0 ? "TODO OK" : `${failures} FALLAS`)
process.exit(failures === 0 ? 0 : 1)
