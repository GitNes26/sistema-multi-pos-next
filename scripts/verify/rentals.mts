/* eslint-disable @typescript-eslint/no-explicit-any -- script de verificación */
// Verifica en la base aislada el ciclo de una renta: depósito (sugerido por la política o capturado),
// entrega y devolución con listas obligatorias, cargo por retraso con gracia, cargo por daños,
// liquidación del depósito (se regresa lo que sobra / queda saldo) y que no se repita ninguno de los pasos.
// Limpia lo que crea.
import fs from "node:fs"
import path from "node:path"

Object.assign(process.env, JSON.parse(fs.readFileSync(path.resolve(".env.test-minimal.local"), "utf8")))
const { assertTestEnvironment } = await import("../test-safety.mjs")
assertTestEnvironment(process.env as Record<string, string>)
const { prisma } = await import("../../src/lib/db")
const rs = await import("../../src/lib/reservations/server")
const cl = await import("../../src/lib/checklists/server")
const pos = await import("../../src/lib/pos/server")
const cash = await import("../../src/lib/reservations/cash")

const orgs = JSON.parse(fs.readFileSync(".loadtest/orgs.json", "utf8"))
const orgId = orgs[5].orgId as string
const customer = await prisma.customer.findFirstOrThrow({ where: { organizationId: orgId } })
const location = await prisma.location.findFirstOrThrow({ where: { organizationId: orgId }, orderBy: { createdAt: "asc" } })

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

const policyBefore = await prisma.rentalPolicy.findUnique({ where: { organizationId: orgId } })
const created = { product: "", reservations: [] as string[], session: "", combo: "", sale: "" }
const day = 86_400_000
try {
  // El depósito se recibe en efectivo en la caja: se usa la abierta o se abre una (y se borra al final).
  const user = await prisma.user.findFirstOrThrow({ select: { id: true } })
  const register = await prisma.cashRegister.findFirstOrThrow({ where: { organizationId: orgId, locationId: location.id } })
  let session = await prisma.cashSession.findFirst({ where: { organizationId: orgId, cashRegister: { locationId: location.id }, status: "open" } })
  if (!session) {
    const opened = await pos.openCashSession(orgId, location.id, register.id, 100, user.id)
    session = (await prisma.cashSession.findUniqueOrThrow({ where: { id: (opened.session as any).id } }))
    created.session = session.id
  }
  const sessionId = session.id
  const cashBefore = await cash.rentalCashForSession(prisma, sessionId)

  const p = await prisma.product.create({
    data: { organizationId: orgId, name: "zz Brincolín", trackInventory: true, variants: { create: { organizationId: orgId, name: "Default", price: 800 } } },
    include: { variants: true },
  })
  created.product = p.id
  const variantId = p.variants[0].id
  await prisma.inventory.create({ data: { organizationId: orgId, variantId, productId: p.id, locationId: location.id, locationType: "location", quantity: 3 } })

  await rs.saveRentalPolicy(orgId, { defaultDeposit: 500, lateFeePerDay: 200, graceMinutes: 60 })
  await expectErr("un depósito negativo en la política se rechaza", () => rs.saveRentalPolicy(orgId, { defaultDeposit: -1 }), "depósito")
  const policy = await rs.getRentalPolicy(orgId)
  check("la política se guarda", policy.defaultDeposit === 500 && policy.lateFeePerDay === 200 && policy.graceMinutes === 60)

  // Fechas lejanas para no chocar con otras reservaciones de la base de pruebas.
  const start = new Date(Date.now() + 400 * day)
  const end = new Date(start.getTime() + 2 * day)
  const a = await rs.createReservation(orgId, { customerId: customer.id, items: [{ variantId, quantity: 1 }], startsAt: start, endsAt: end })
  created.reservations.push(a.id)
  const rowA = (await rs.getReservations(orgId, new Date(start.getTime() - day), new Date(end.getTime() + day))).find((r) => r.id === a.id)!
  check("sin capturar depósito se usa el sugerido por la política", rowA.depositAmount === 500)

  const b = await rs.createReservation(orgId, { customerId: customer.id, items: [{ variantId, quantity: 1 }], startsAt: start, endsAt: end, depositAmount: 0 })
  created.reservations.push(b.id)
  const rowB = (await rs.getReservations(orgId, new Date(start.getTime() - day), new Date(end.getTime() + day))).find((r) => r.id === b.id)!
  check("un depósito de 0 capturado se respeta", rowB.depositAmount === 0)
  await expectErr("un depósito negativo se rechaza", () => rs.createReservation(orgId, { customerId: customer.id, items: [{ variantId, quantity: 1 }], startsAt: start, endsAt: end, depositAmount: -5 }), "depósito")

  // Entrega
  await expectErr("no se entrega una reservación sin confirmar", () => rs.deliverReservation(orgId, a.id), "confirma")
  await rs.updateReservation(orgId, a.id, { status: "confirmed" })
  await cl.saveTemplate(orgId, { subjectType: "reservation", phase: "delivery", isRequired: true, items: [{ label: "Ventilador funciona", requirePhoto: false }] })
  await cl.saveTemplate(orgId, { subjectType: "reservation", phase: "return", isRequired: true, items: [{ label: "Sin daños", requirePhoto: false }] })
  await expectErr("con entrega obligatoria no se entrega sin revisión", () => rs.deliverReservation(orgId, a.id), "revisión")
  await cl.saveRun(orgId, { subjectType: "reservation", subjectId: a.id, phase: "delivery", items: [{ label: "Ventilador funciona", status: "ok" }] })
  await rs.deliverReservation(orgId, a.id, user.id)
  await expectErr("no se entrega dos veces", () => rs.deliverReservation(orgId, a.id), "ya fue entregado")
  const afterDeliver = await cash.rentalCashForSession(prisma, sessionId)
  check("al entregar el depósito (500) entra a la caja", afterDeliver.cashIn - cashBefore.cashIn === 500, `(${afterDeliver.cashIn - cashBefore.cashIn})`)

  // Devolución
  await expectErr("no se recibe sin la revisión de devolución obligatoria", () => rs.returnReservation(orgId, a.id, {}), "revisión")
  await cl.saveRun(orgId, { subjectType: "reservation", subjectId: a.id, phase: "return", items: [{ label: "Sin daños", status: "ok" }] })
  await expectErr("el cargo por daños negativo se rechaza", () => rs.returnReservation(orgId, a.id, { damageFee: -10 }), "daños")
  // Dos días y medio tarde (gracia de 1 h): 3 días de cargo = 600; daños 150 → 750 contra depósito 500.
  const late = new Date(end.getTime() + 2 * day + 12 * 3600_000)
  const res = await rs.returnReservation(orgId, a.id, { damageFee: 150, penaltyNotes: "Rasgadura", returnedAt: late }, user.id)
  check("retraso: 3 días × 200 = 600", res.lateFee === 600, `(${res.lateFee})`)
  check("daños capturados 150", res.damageFee === 150)
  check("el depósito no alcanza: no se regresa nada y quedan 250 por cobrar", res.depositRefund === 0 && res.balanceDue === 250, `(${res.depositRefund}/${res.balanceDue})`)
  const afterReturnA = await cash.rentalCashForSession(prisma, sessionId)
  check("el saldo de 250 por cargos entra a la caja y no se regresa nada", afterReturnA.cashIn - cashBefore.cashIn === 750 && afterReturnA.cashOut === cashBefore.cashOut, `(${afterReturnA.cashIn - cashBefore.cashIn}/${afterReturnA.cashOut - cashBefore.cashOut})`)
  check("la renta ya no queda pendiente de caja", (res as any).cashPending === false)
  const again = await cash.settleRentalCash(orgId, a.id, user.id)
  check("registrar en caja dos veces no duplica", again.registered.length === 0 && (await cash.rentalCashForSession(prisma, sessionId)).cashIn === afterReturnA.cashIn)
  await expectErr("no se recibe dos veces", () => rs.returnReservation(orgId, a.id, {}), "ya fue devuelto")

  // Devolución a tiempo con depósito de sobra
  await prisma.reservation.update({ where: { id: b.id }, data: { depositAmount: 500, status: "confirmed" } })
  await expectErr("no se recibe lo que no se entregó", () => rs.returnReservation(orgId, b.id, {}), "entrega")
  await cl.saveRun(orgId, { subjectType: "reservation", subjectId: b.id, phase: "delivery", items: [{ label: "Ventilador funciona", status: "ok" }] })
  await rs.deliverReservation(orgId, b.id, user.id)
  await cl.saveRun(orgId, { subjectType: "reservation", subjectId: b.id, phase: "return", items: [{ label: "Sin daños", status: "issue", note: "mancha" }] })
  const ok = await rs.returnReservation(orgId, b.id, { damageFee: 100, returnedAt: new Date(end.getTime() + 30 * 60_000) }, user.id)
  check("dentro de la gracia no hay retraso", ok.lateFee === 0)
  check("con daños de 100 se regresan 400 del depósito", ok.depositRefund === 400 && ok.balanceDue === 0, `(${ok.depositRefund}/${ok.balanceDue})`)

  const afterReturnB = await cash.rentalCashForSession(prisma, sessionId)
  check("los 400 que se regresan salen de la caja", afterReturnB.cashOut - cashBefore.cashOut === 400, `(${afterReturnB.cashOut - cashBefore.cashOut})`)

  const pStart = new Date(start.getTime() + 60 * day)
  const pEnd = new Date(pStart.getTime() + 2 * day)
  // Paquete de renta (combo): sus artículos van a precio de lista y el paquete descuenta la diferencia
  const combo = await prisma.productCombo.create({ data: { organizationId: orgId, name: "zz Paquete fiesta", comboPrice: 1200, items: { create: { productId: p.id, variantId, quantity: 2 } } } })
  created.combo = combo.id
  const pkgs = await rs.getRentalPackages(orgId)
  const found = pkgs.find((x) => x.id === combo.id)
  check("el combo de artículos rentables aparece como paquete", Boolean(found) && found!.price === 1200 && found!.listPrice === 1600, `(${found?.price}/${found?.listPrice})`)
  const pk = await rs.createReservation(orgId, { customerId: customer.id, items: [], packages: [{ comboId: combo.id, quantity: 1 }], startsAt: pStart, endsAt: pEnd, depositAmount: 0 })
  created.reservations.push(pk.id)
  const pkRow = (await rs.getReservations(orgId, new Date(pStart.getTime() - day), new Date(pEnd.getTime() + day))).find((r) => r.id === pk.id)!
  check("el paquete guarda 2 piezas a precio de lista y un descuento de 400", pkRow.items.length === 1 && pkRow.items[0].quantity === 2 && pkRow.packageDiscount === 400 && pkRow.total === 1200, `(${pkRow.items[0]?.quantity}/${pkRow.packageDiscount}/${pkRow.total})`)
  await expectErr("el paquete respeta la disponibilidad (3 piezas: 2 del paquete y se piden 1 suelta + 2 de otro paquete)", () => rs.createReservation(orgId, { customerId: customer.id, items: [{ variantId, quantity: 1 }], packages: [{ comboId: combo.id, quantity: 2 }], startsAt: pStart, endsAt: pEnd, depositAmount: 0 }), "solo hay")
  await expectErr("un paquete inexistente se rechaza", () => rs.createReservation(orgId, { customerId: customer.id, items: [], packages: [{ comboId: "nada", quantity: 1 }], startsAt: pStart, endsAt: pEnd }), "paquete")
  const paid = await rs.checkoutReservation(orgId, pk.id, "cash", { userId: user.id, employeeId: null })
  created.sale = paid.saleId
  const sale = await prisma.sale.findUniqueOrThrow({ where: { id: paid.saleId } })
  check("la venta cobra el precio del paquete con su descuento", Number(sale.subtotal) === 1600 && Number(sale.discount) === 400 && Number(sale.total) === paid.total, `(${sale.subtotal}/${sale.discount}/${sale.total})`)

  // Otra empresa no ve ni toca la renta
  await expectErr("otra empresa no puede entregar una renta ajena", () => rs.deliverReservation(orgs[4].orgId, a.id), "no encontrada")
} finally {
  const ids = created.reservations
  if (created.sale) {
    await prisma.reservation.updateMany({ where: { id: { in: ids } }, data: { saleId: null } })
    await prisma.salePayment.deleteMany({ where: { saleId: created.sale } })
    await prisma.saleItem.deleteMany({ where: { saleId: created.sale } })
    await prisma.saleDiscount.deleteMany({ where: { saleId: created.sale } }).catch(() => undefined)
    await prisma.sale.delete({ where: { id: created.sale } }).catch(() => undefined)
  }
  if (created.combo) {
    await prisma.comboItem.deleteMany({ where: { comboId: created.combo } })
    await prisma.productCombo.delete({ where: { id: created.combo } })
  }
  await prisma.rentalCashEntry.deleteMany({ where: { reservationId: { in: ids } } })
  await prisma.checklistRunItem.deleteMany({ where: { run: { organizationId: orgId, subjectId: { in: ids } } } })
  await prisma.checklistRun.deleteMany({ where: { organizationId: orgId, subjectId: { in: ids } } })
  await prisma.checklistTemplateItem.deleteMany({ where: { template: { organizationId: orgId, subjectType: "reservation" } } })
  await prisma.checklistTemplate.deleteMany({ where: { organizationId: orgId, subjectType: "reservation" } })
  await prisma.reservationItem.deleteMany({ where: { reservationId: { in: ids } } })
  await prisma.reservation.deleteMany({ where: { id: { in: ids } } })
  if (created.product) {
    await prisma.inventory.deleteMany({ where: { productId: created.product } })
    await prisma.productVariant.deleteMany({ where: { productId: created.product } })
    await prisma.product.delete({ where: { id: created.product } })
  }
  if (created.session) await prisma.cashSession.delete({ where: { id: created.session } })
  if (!policyBefore) await prisma.rentalPolicy.deleteMany({ where: { organizationId: orgId } })
  await prisma.$disconnect()
}
console.log(failures === 0 ? "TODO OK" : `${failures} FALLAS`)
process.exit(failures === 0 ? 0 : 1)
