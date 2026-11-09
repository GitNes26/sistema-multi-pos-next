/* eslint-disable @typescript-eslint/no-explicit-any -- script de verificación */
// Verifica en la base aislada la reserva de citas desde el portal: servicios con personal, horarios libres,
// cita sin preferencia (por asignar) y con persona, choques, cancelación propia y aislamiento. Limpia lo que crea.
import fs from "node:fs"
import path from "node:path"

Object.assign(process.env, JSON.parse(fs.readFileSync(path.resolve(".env.test-minimal.local"), "utf8")))
const { assertTestEnvironment } = await import("../test-safety.mjs")
assertTestEnvironment(process.env as Record<string, string>)
const { prisma } = await import("../../src/lib/db")
const portal = await import("../../src/lib/agenda/portal")

const orgs = JSON.parse(fs.readFileSync(".loadtest/orgs.json", "utf8"))
const orgId = orgs[5].orgId as string
const user = await prisma.user.findFirstOrThrow({ select: { id: true } })

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

const org = await prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { businessMode: true } })
const policyBefore = await prisma.appointmentPolicy.findUnique({ where: { organizationId: orgId } })
const created = { product: "", employees: [] as string[], users: [] as string[], es: [] as string[], customer: "", mode: false }
try {
  // Restos de una corrida interrumpida
  await prisma.appointmentEvent.deleteMany({ where: { appointment: { notes: "zz portal" } } })
  await prisma.appointment.deleteMany({ where: { organizationId: orgId, notes: "zz portal" } })
  const oldEmps = await prisma.employee.findMany({ where: { organizationId: orgId, fullName: { startsWith: "zz Portal" } }, select: { id: true, userId: true } })
  await prisma.employeeService.deleteMany({ where: { employeeId: { in: oldEmps.map((e) => e.id) } } })
  await prisma.employee.deleteMany({ where: { id: { in: oldEmps.map((e) => e.id) } } })
  await prisma.user.deleteMany({ where: { id: { in: oldEmps.map((e) => e.userId).filter(Boolean) as string[] } } })
  const oldProducts = await prisma.product.findMany({ where: { organizationId: orgId, name: "zz Corte portal" }, select: { id: true } })
  await prisma.productVariant.deleteMany({ where: { productId: { in: oldProducts.map((p) => p.id) } } })
  await prisma.product.deleteMany({ where: { id: { in: oldProducts.map((p) => p.id) } } })

  if (org.businessMode !== "services" && org.businessMode !== "hybrid") {
    await prisma.organization.update({ where: { id: orgId }, data: { businessMode: "services" } })
    created.mode = true
  }
  // Sin restricción de horario del negocio: los horarios salen del rango por defecto del portal (9:00–20:00)
  await prisma.appointmentPolicy.upsert({
    where: { organizationId: orgId },
    create: { organizationId: orgId, enforceBusinessHours: false, minNoticeMinutes: 30, maxAdvanceDays: 60 },
    update: { enforceBusinessHours: false, minNoticeMinutes: 30, maxAdvanceDays: 60 },
  })
  const { invalidateOrg } = await import("../../src/lib/cache")
  invalidateOrg(orgId)

  const customer = await prisma.customer.findFirstOrThrow({ where: { organizationId: orgId } })
  const product = await prisma.product.create({ data: { organizationId: orgId, name: "zz Corte portal", trackInventory: false, variants: { create: { organizationId: orgId, name: "Default", price: 120 } } }, include: { variants: true } })
  created.product = product.id
  const variantId = product.variants[0].id
  const mk = async (name: string, duration: number) => {
    const u = await prisma.user.create({ data: { email: `zz-portal-${name}-${Date.now()}@test.local`, fullName: `zz Portal ${name}`, passwordHash: "x" } as any })
    created.users.push(u.id)
    const e = await prisma.employee.create({ data: { organizationId: orgId, userId: u.id, fullName: `zz Portal ${name}` } })
    created.employees.push(e.id)
    await prisma.employeeService.create({ data: { organizationId: orgId, employeeId: e.id, variantId, durationMin: duration } })
    return e
  }
  const ana = await mk("Ana", 30)
  const beto = await mk("Beto", 45)

  const info = await portal.getPortalBooking(orgId, customer.id)
  const svc = info.services.find((s) => s.variantId === variantId)
  check("el portal lista el servicio con su personal", Boolean(svc) && svc!.staffIds.length === 2 && svc!.durationMin === 30, `(${svc?.staffIds.length}/${svc?.durationMin})`)

  const day = new Date(Date.now() + 5 * 86_400_000)
  const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`
  const all = await portal.getPortalSlots(orgId, { variantId, date })
  check("hay horarios libres en un día futuro", all.length > 10, `(${all.length})`)
  const noon = all.find((s) => s.time === "12:00")
  check("existe el horario de las 12:00", Boolean(noon))

  const first = await portal.bookPortalAppointment(orgId, customer.id, user.id, { variantId, startsAt: new Date(noon!.startsAt), notes: "zz portal" })
  const row = await prisma.appointment.findUniqueOrThrow({ where: { id: first.id } })
  check("sin preferencia la cita queda por asignar", row.employeeId === null && row.status === "pending")

  const afterOne = await portal.getPortalSlots(orgId, { variantId, date })
  check("con 2 personas y 1 cita aún queda el horario", afterOne.some((s) => s.time === "12:00"))
  await portal.bookPortalAppointment(orgId, customer.id, user.id, { variantId, startsAt: new Date(noon!.startsAt), notes: "zz portal" })
  const afterTwo = await portal.getPortalSlots(orgId, { variantId, date })
  check("con 2 citas y 2 personas el horario se agota", !afterTwo.some((s) => s.time === "12:00"))
  await expectErr("no se agenda un horario agotado", () => portal.bookPortalAppointment(orgId, customer.id, user.id, { variantId, startsAt: new Date(noon!.startsAt), notes: "zz portal" }), "ya no está disponible")

  // Con persona elegida: Ana está ocupada por citas por asignar solo si no queda nadie; Beto tampoco tiene
  const withAna = await portal.getPortalSlots(orgId, { variantId, date, employeeId: ana.id })
  check("elegir persona respeta sus propias citas (ninguna asignada: queda libre)", withAna.some((s) => s.time === "12:00"))
  const booked = await portal.bookPortalAppointment(orgId, customer.id, user.id, { variantId, employeeId: beto.id, startsAt: new Date(all.find((s) => s.time === "15:00")!.startsAt), notes: "zz portal" })
  const bookedRow = await prisma.appointment.findUniqueOrThrow({ where: { id: booked.id } })
  check("con persona elegida queda asignada y con su duración (45 min)", bookedRow.employeeId === beto.id && bookedRow.durationMin === 45, `(${bookedRow.durationMin})`)
  const betoSlots = await portal.getPortalSlots(orgId, { variantId, date, employeeId: beto.id })
  check("esa persona ya no tiene las 15:00 ni las 15:30", !betoSlots.some((s) => s.time === "15:00" || s.time === "15:30") && betoSlots.some((s) => s.time === "16:00"))
  await expectErr("una persona que no presta el servicio se rechaza", () => portal.getPortalSlots(orgId, { variantId, date, employeeId: "nadie" }), "no atiende")

  // Cancelación propia y ajena
  await portal.cancelPortalAppointment(orgId, customer.id, user.id, first.id)
  check("la cancelación libera el horario", (await portal.getPortalSlots(orgId, { variantId, date })).some((s) => s.time === "12:00"))
  const other = await prisma.customer.findFirst({ where: { organizationId: orgId, id: { not: customer.id } } })
  if (other) await expectErr("no se cancela la cita de otro cliente", () => portal.cancelPortalAppointment(orgId, other.id, user.id, booked.id), "no encontrada")
  await expectErr("otra empresa no agenda en este negocio", () => portal.getPortalSlots(orgs[4].orgId, { variantId, date }), "")
} finally {
  await prisma.appointmentEvent.deleteMany({ where: { appointment: { notes: "zz portal" } } })
  await prisma.appointment.deleteMany({ where: { organizationId: orgId, notes: "zz portal" } })
  await prisma.employeeService.deleteMany({ where: { employeeId: { in: created.employees } } })
  await prisma.employee.deleteMany({ where: { id: { in: created.employees } } })
  await prisma.user.deleteMany({ where: { id: { in: created.users } } })
  if (created.product) {
    await prisma.productVariant.deleteMany({ where: { productId: created.product } })
    await prisma.product.delete({ where: { id: created.product } }).catch(() => undefined)
  }
  if (!policyBefore) await prisma.appointmentPolicy.deleteMany({ where: { organizationId: orgId } })
  else await prisma.appointmentPolicy.update({ where: { organizationId: orgId }, data: { enforceBusinessHours: policyBefore.enforceBusinessHours, minNoticeMinutes: policyBefore.minNoticeMinutes, maxAdvanceDays: policyBefore.maxAdvanceDays } })
  if (created.mode) await prisma.organization.update({ where: { id: orgId }, data: { businessMode: org.businessMode } })
  await prisma.$disconnect()
}
console.log(failures === 0 ? "TODO OK" : `${failures} FALLAS`)
process.exit(failures === 0 ? 0 : 1)
