import { prisma } from "@/lib/db"
import { parseSchedule, zonedParts, zonedToDate } from "@/lib/schedule"
import { AGENDA_MODES, AgendaError, createAppointment, updateAppointment } from "./server"
import { assertBookingWindow, assertWithinBusinessHours, getAppointmentPolicy, PolicyError } from "./policy"

// Reserva de citas desde el portal del cliente: él elige servicio, (opcionalmente) a quién y qué silla,
// y un día con horarios libres. Sin preferencia de personal, la cita queda «por asignar».
// Todo se valida en servidor con las mismas reglas de la agenda (horario, anticipación, choques).

const SLOT_STEP_MIN = 30
const DEFAULT_OPEN = { open: 9 * 60, close: 20 * 60 }

export async function assertPortalAgenda(organizationId: string) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { businessMode: true } })
  if (!org || !AGENDA_MODES.includes(org.businessMode)) throw new AgendaError("Este negocio no agenda citas", 404)
}

export interface PortalBooking {
  services: { variantId: string; name: string; price: number; durationMin: number; staffIds: string[] }[]
  staff: { id: string; fullName: string }[]
  stations: { id: string; name: string }[]
  maxAdvanceDays: number
  appointments: {
    id: string
    status: string
    startsAt: string
    endsAt: string
    service: string
    employee: string | null
    station: string | null
    canCancel: boolean
  }[]
}

export async function getPortalBooking(organizationId: string, customerId: string): Promise<PortalBooking> {
  await assertPortalAgenda(organizationId)
  const [assignments, stations, policy, mine] = await Promise.all([
    prisma.employeeService.findMany({
      where: { organizationId, isActive: true, employee: { isActive: true }, variant: { isActive: true, product: { isActive: true, trackInventory: false } } },
      select: { employeeId: true, durationMin: true, employee: { select: { id: true, fullName: true } }, variant: { select: { id: true, price: true, product: { select: { name: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.serviceStation.findMany({ where: { organizationId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getAppointmentPolicy(organizationId),
    prisma.appointment.findMany({
      where: { organizationId, customerId, startsAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
      select: { id: true, status: true, startsAt: true, endsAt: true, checkedInAt: true, variant: { select: { product: { select: { name: true } } } }, employee: { select: { fullName: true } }, station: { select: { name: true } } },
      orderBy: { startsAt: "desc" },
      take: 50,
    }),
  ])
  const services = new Map<string, PortalBooking["services"][number]>()
  const staff = new Map<string, { id: string; fullName: string }>()
  for (const a of assignments) {
    staff.set(a.employee.id, { id: a.employee.id, fullName: a.employee.fullName })
    const known = services.get(a.variant.id)
    if (!known) {
      services.set(a.variant.id, { variantId: a.variant.id, name: a.variant.product.name, price: Number(a.variant.price), durationMin: a.durationMin, staffIds: [a.employeeId] })
    } else {
      known.staffIds.push(a.employeeId)
      known.durationMin = Math.min(known.durationMin, a.durationMin)
    }
  }
  const now = Date.now()
  return {
    services: [...services.values()],
    staff: [...staff.values()],
    stations,
    maxAdvanceDays: policy.maxAdvanceDays,
    appointments: mine.map((a) => ({
      id: a.id,
      status: a.status,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt.toISOString(),
      service: a.variant.product.name,
      employee: a.employee?.fullName ?? null,
      station: a.station?.name ?? null,
      canCancel: (a.status === "pending" || a.status === "confirmed") && !a.checkedInAt && a.startsAt.getTime() > now,
    })),
  }
}

interface SlotQuery {
  variantId: string
  employeeId?: string | null
  stationId?: string | null
  /** YYYY-MM-DD en la zona del negocio. */
  date: string
}

/** Resuelve duración y personal elegible del servicio (todos o solo el elegido). */
async function resolveService(organizationId: string, q: Pick<SlotQuery, "variantId" | "employeeId" | "stationId">) {
  const offered = await prisma.employeeService.findMany({
    where: { organizationId, variantId: q.variantId, isActive: true, employee: { isActive: true }, ...(q.employeeId ? { employeeId: q.employeeId } : {}) },
    select: { employeeId: true, durationMin: true },
  })
  if (offered.length === 0) throw new AgendaError(q.employeeId ? "Esa persona no atiende el servicio" : "Servicio no disponible para agendar", 409)
  if (q.stationId) {
    const station = await prisma.serviceStation.findFirst({ where: { id: q.stationId, organizationId, isActive: true }, select: { id: true } })
    if (!station) throw new AgendaError("Lugar de atención no encontrado", 404)
  }
  return { employeeIds: offered.map((o) => o.employeeId), durationMin: Math.min(...offered.map((o) => o.durationMin)) }
}

/** Horarios libres del día (inicio de cada tramo de 30 min con espacio para el servicio completo). */
export async function getPortalSlots(organizationId: string, q: SlotQuery): Promise<{ time: string; startsAt: string }[]> {
  await assertPortalAgenda(organizationId)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(q.date)
  if (!m) throw new AgendaError("Fecha inválida", 400)
  const { employeeIds, durationMin } = await resolveService(organizationId, q)
  const policy = await getAppointmentPolicy(organizationId)
  const location = await prisma.location.findFirst({ where: { organizationId, isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true, timezone: true, openingScheduleJson: true } })
  const tz = location?.timezone || "America/Mexico_City"
  const year = Number(m[1])
  const month = Number(m[2]) - 1
  const day = Number(m[3])

  // Tramos de atención del día (si el negocio no configuró horario o no lo exige, uno por defecto).
  const dayStart = zonedToDate(year, month, day, 0, tz)
  const weekday = zonedParts(new Date(dayStart.getTime() + 12 * 3_600_000), tz).weekday
  let windows = [DEFAULT_OPEN]
  const schedule = location?.openingScheduleJson ? parseSchedule(location.openingScheduleJson) : []
  if (policy.enforceBusinessHours && schedule.some((d) => d.enabled)) {
    const today = schedule.find((d) => d.day === weekday)
    const toMin = (hhmm: string) => { const [h, mi] = hhmm.split(":").map(Number); return h * 60 + mi }
    windows = today?.enabled ? today.slots.map((s) => ({ open: toMin(s.open), close: toMin(s.close) })) : []
  }

  const dayEnd = zonedToDate(year, month, day + 1, 0, tz)
  const busy = await prisma.appointment.findMany({
    where: { organizationId, status: { notIn: ["cancelled", "no_show"] }, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
    select: { employeeId: true, stationId: true, startsAt: true, endsAt: true },
  })

  const out: { time: string; startsAt: string }[] = []
  for (const w of windows) {
    for (let min = w.open; min + durationMin <= w.close; min += SLOT_STEP_MIN) {
      const startsAt = zonedToDate(year, month, day, min, tz)
      const endsAt = new Date(startsAt.getTime() + durationMin * 60_000)
      try {
        assertBookingWindow(policy, startsAt)
        await assertWithinBusinessHours(organizationId, location?.id ?? null, startsAt, endsAt, policy)
      } catch (err) {
        if (err instanceof PolicyError) continue
        throw err
      }
      const overlapping = busy.filter((b) => b.startsAt < endsAt && b.endsAt > startsAt)
      if (q.stationId && overlapping.some((b) => b.stationId === q.stationId)) continue
      if (q.employeeId) {
        if (overlapping.some((b) => b.employeeId === q.employeeId)) continue
      } else {
        // Sin preferencia: hay lugar si queda alguien elegible libre (las citas por asignar también ocupan).
        const taken = overlapping.filter((b) => b.employeeId === null || employeeIds.includes(b.employeeId)).length
        if (taken >= employeeIds.length) continue
      }
      out.push({ time: `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`, startsAt: startsAt.toISOString() })
    }
  }
  return out
}

export async function bookPortalAppointment(
  organizationId: string,
  customerId: string,
  userId: string,
  input: { variantId: string; employeeId?: string | null; stationId?: string | null; startsAt: Date; notes?: string | null }
) {
  await assertPortalAgenda(organizationId)
  if (Number.isNaN(input.startsAt.getTime())) throw new AgendaError("Horario inválido", 400)
  // El horario debe ser uno de los que el servidor ofrece (misma regla que la lista de horarios libres).
  const tzParts = await prisma.location.findFirst({ where: { organizationId, isActive: true }, orderBy: { createdAt: "asc" }, select: { timezone: true } })
  const z = zonedParts(input.startsAt, tzParts?.timezone || "America/Mexico_City")
  const date = `${z.year}-${String(z.month + 1).padStart(2, "0")}-${String(z.day).padStart(2, "0")}`
  const free = await getPortalSlots(organizationId, { variantId: input.variantId, employeeId: input.employeeId, stationId: input.stationId, date })
  if (!free.some((s) => new Date(s.startsAt).getTime() === input.startsAt.getTime())) throw new AgendaError("Ese horario ya no está disponible", 409)
  const created = await createAppointment(organizationId, {
    customerId,
    employeeId: input.employeeId || null,
    variantId: input.variantId,
    startsAt: input.startsAt,
    stationId: input.stationId || null,
    notes: input.notes?.trim() ? input.notes.trim().slice(0, 500) : null,
    actorUserId: userId,
  })
  return { id: created.id }
}

export async function cancelPortalAppointment(organizationId: string, customerId: string, userId: string, id: string) {
  await assertPortalAgenda(organizationId)
  const mine = await prisma.appointment.findFirst({ where: { id, organizationId, customerId }, select: { id: true, status: true, checkedInAt: true, startsAt: true } })
  if (!mine) throw new AgendaError("Cita no encontrada", 404)
  if ((mine.status !== "pending" && mine.status !== "confirmed") || mine.checkedInAt) throw new AgendaError("Esta cita ya no se puede cancelar", 409)
  if (mine.startsAt.getTime() <= Date.now()) throw new AgendaError("La cita ya empezó", 409)
  await updateAppointment(organizationId, id, { status: "cancelled", actorUserId: userId })
}
