/* eslint-disable @typescript-eslint/no-explicit-any -- script de verificación */
import fs from "node:fs"
import path from "node:path"


Object.assign(process.env, JSON.parse(fs.readFileSync(path.resolve(".env.test-minimal.local"), "utf8")))
const { assertTestEnvironment } = await import("../test-safety.mjs")
assertTestEnvironment(process.env as Record<string, string>)
const { prisma } = await import("../../src/lib/db/index.ts")
const { createAppointment, updateAppointment, checkInAppointment } = await import("../../src/lib/agenda/server.ts")
const { saveAppointmentPolicy, sweepLateAppointments, getAppointmentHistory, PolicyError } = await import("../../src/lib/agenda/policy.ts")
const { invalidateOrg } = await import("../../src/lib/cache/index.ts")

const orgs = JSON.parse(fs.readFileSync(".loadtest/orgs.json", "utf8"))
const orgId = orgs[3].orgId as string
const loc = await prisma.location.findFirstOrThrow({ where: { organizationId: orgId }, orderBy: { createdAt: "asc" } })
const anyUser = await prisma.user.findFirstOrThrow({ select: { id: true } })
let tempEmp = false
let emp = await prisma.employee.findFirst({ where: { organizationId: orgId, isActive: true } })
if (!emp) { emp = await prisma.employee.create({ data: { organizationId: orgId, userId: anyUser.id, fullName: "Prueba política" } }); tempEmp = true }
const variant = await prisma.productVariant.findFirstOrThrow({ where: { organizationId: orgId, isActive: true } })
const customer = await prisma.customer.findFirstOrThrow({ where: { organizationId: orgId } })
const oldSchedule = loc.openingScheduleJson
const created: string[] = []
let failures = 0
const check = (name: string, ok: boolean, extra = "") => { console.log(`${ok ? "OK  " : "FALLA"} ${name} ${extra}`); if (!ok) failures += 1 }
const expectErr = async (name: string, code: string, fn: () => Promise<unknown>) => {
  try { await fn(); check(name, false, "no lanzó error") } catch (e: any) { check(name, e instanceof PolicyError && e.code === code, `(${e?.code ?? e?.message})`) }
}

// Horario: todos los días de 00:00 a 23:59 salvo pruebas específicas.
const allDay = JSON.stringify(Array.from({ length: 7 }, (_, d) => ({ day: d, enabled: true, slots: [{ open: "09:00", close: "18:00" }] })))
await prisma.location.update({ where: { id: loc.id }, data: { openingScheduleJson: allDay } })
await prisma.employeeService.deleteMany({ where: { employeeId: emp.id, variantId: variant.id } })
await prisma.employeeService.create({ data: { organizationId: orgId, employeeId: emp.id, variantId: variant.id, durationMin: 30 } })

try {
  await saveAppointmentPolicy(orgId, { enforceBusinessHours: true, minNoticeMinutes: 30, maxAdvanceDays: 60, rescheduleMinNoticeMinutes: 120, maxReschedules: 1, toleranceMinutes: 15 })
  const tz = loc.timezone || "America/Mexico_City"
  const at = (daysAhead: number, hh: number) => {
    // hh en hora local del negocio: se busca el instante UTC que corresponde.
    const base = new Date(Date.now() + daysAhead * 86_400_000)
    for (let h = 0; h < 48; h += 1) {
      const cand = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), h - 12, 0, 0))
      const local = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hour12: false }).format(cand)) % 24
      const dayOk = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(cand) === new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(base)
      if (local === hh && dayOk) return cand
    }
    throw new Error("sin hora")
  }
  const base = { customerId: customer.id, employeeId: emp.id, variantId: variant.id }

  await expectErr("fuera de horario (23:00) se rechaza", "business_hours", () => createAppointment(orgId, { ...base, startsAt: at(3, 23) }))
  await expectErr("fuera de horario (07:00) se rechaza", "business_hours", () => createAppointment(orgId, { ...base, startsAt: at(3, 7) }))
  await expectErr("más allá de la ventana (90 días)", "max_advance", () => createAppointment(orgId, { ...base, startsAt: at(90, 10) }))

  const a = await createAppointment(orgId, { ...base, startsAt: at(3, 10), actorUserId: null })
  created.push(a.id)
  check("cita dentro de horario se crea", Boolean(a.id))

  // Reagenda con anticipación suficiente (3 días) → permitida, cuenta 1.
  await updateAppointment(orgId, a.id, { startsAt: at(4, 11) })
  const after1 = await prisma.appointment.findUniqueOrThrow({ where: { id: a.id } })
  check("reagenda con tiempo suficiente", after1.rescheduleCount === 1)
  await expectErr("segunda reagenda supera el límite (1)", "reschedule_limit", () => updateAppointment(orgId, a.id, { startsAt: at(5, 11) }))
  await updateAppointment(orgId, a.id, { startsAt: at(5, 11), override: { reason: "Cliente enfermo" } })
  const after2 = await prisma.appointment.findUniqueOrThrow({ where: { id: a.id } })
  check("con motivo se salta el límite", after2.rescheduleCount === 2)
  await expectErr("reagenda a una hora fuera de horario", "business_hours", () => updateAppointment(orgId, a.id, { startsAt: at(5, 22), override: { reason: "x" } }))

  // Cita cercana: faltan ~60 min (< 120) → no se puede reagendar sin motivo. Se crea directo para esquivar horario.
  const soon = await prisma.appointment.create({ data: { organizationId: orgId, locationId: loc.id, customerId: customer.id, employeeId: emp.id, variantId: variant.id, status: "confirmed", startsAt: new Date(Date.now() + 60 * 60_000), endsAt: new Date(Date.now() + 90 * 60_000), durationMin: 30 } })
  created.push(soon.id)
  await expectErr("reagendar con menos de 2 h de anticipación", "reschedule_notice", () => updateAppointment(orgId, soon.id, { startsAt: at(6, 10) }))

  // Tolerancia: una cita de hace 20 min (se pierde) y una de hace 5 min (se conserva).
  const mk = (minAgo: number) => prisma.appointment.create({ data: { organizationId: orgId, locationId: loc.id, customerId: customer.id, employeeId: emp.id, variantId: variant.id, status: "confirmed", startsAt: new Date(Date.now() - minAgo * 60_000), endsAt: new Date(Date.now() - (minAgo - 30) * 60_000), durationMin: 30 } })
  const late = await mk(20); const ok5 = await mk(5); const arrived = await mk(25)
  created.push(late.id, ok5.id, arrived.id)
  await prisma.appointment.update({ where: { id: arrived.id }, data: { checkedInAt: new Date() } })
  await sweepLateAppointments(orgId)
  const [l, o, ar] = await Promise.all([late, ok5, arrived].map((x) => prisma.appointment.findUniqueOrThrow({ where: { id: x.id } })))
  check("pasada la tolerancia se pierde (no_show)", l.status === "no_show")
  check("dentro de la tolerancia se conserva", o.status === "confirmed")
  check("si ya llegó no se pierde aunque pase la hora", ar.status === "confirmed")
  const hist = await getAppointmentHistory(orgId, late.id)
  check("el historial registra la pérdida automática", hist.some((e: any) => e.type === "auto_no_show"))

  await expectErr("«Llegó» tras perderse exige motivo", "tolerance", () => checkInAppointment(orgId, late.id, {}))
  await checkInAppointment(orgId, late.id, { override: { reason: "Tráfico, avisó por teléfono" } })
  const rec = await prisma.appointment.findUniqueOrThrow({ where: { id: late.id } })
  check("con motivo se recibe y queda confirmada", rec.status === "confirmed" && rec.checkedInAt !== null)
  await checkInAppointment(orgId, ok5.id, {})
  const hist2 = await getAppointmentHistory(orgId, ok5.id)
  check("«Llegó» dentro de tolerancia queda en el historial", hist2.some((e: any) => e.type === "checked_in"))
  const histA = await getAppointmentHistory(orgId, a.id)
  check("historial de la cita: alta + 2 reagendas", histA.filter((e: any) => e.type === "created").length === 1 && histA.filter((e: any) => e.type === "rescheduled").length === 2, JSON.stringify(histA.map((e: any) => e.type)))
} finally {
  await prisma.appointmentEvent.deleteMany({ where: { appointmentId: { in: created } } })
  await prisma.appointment.deleteMany({ where: { id: { in: created } } })
  await prisma.employeeService.deleteMany({ where: { employeeId: emp.id, variantId: variant.id } })
  await prisma.appointmentPolicy.deleteMany({ where: { organizationId: orgId } })
  await prisma.location.update({ where: { id: loc.id }, data: { openingScheduleJson: oldSchedule } })
  if (tempEmp) await prisma.employee.delete({ where: { id: emp.id } })
  invalidateOrg(orgId)
  await prisma.$disconnect()
}
console.log(failures === 0 ? "TODO OK" : `${failures} FALLAS`)
process.exit(failures === 0 ? 0 : 1)
