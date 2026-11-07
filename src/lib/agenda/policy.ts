import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { cached, invalidateOrg, orgTag } from "@/lib/cache"
import { formatSchedule, parseSchedule, zonedParts } from "@/lib/schedule"

// Política de citas: dentro del horario del negocio, anticipación para agendar, reagenda con tiempo
// mínimo y límite, y tolerancia de llegada (pasada la tolerancia sin «Llegó» la cita se pierde).
// Todo evento queda en el historial de la cita (`AppointmentEvent`).

export interface AppointmentPolicyDto {
  enforceBusinessHours: boolean
  minNoticeMinutes: number
  maxAdvanceDays: number
  rescheduleMinNoticeMinutes: number
  /** null = sin límite de reagendas. */
  maxReschedules: number | null
  toleranceMinutes: number
}

export const DEFAULT_APPOINTMENT_POLICY: AppointmentPolicyDto = {
  enforceBusinessHours: true,
  minNoticeMinutes: 30,
  maxAdvanceDays: 60,
  rescheduleMinNoticeMinutes: 120,
  maxReschedules: 2,
  toleranceMinutes: 15,
}

/** Error de política: si `overridable`, quien administra puede continuar dejando un motivo. */
export class PolicyError extends Error {
  status = 409
  overridable: boolean
  code: string
  constructor(message: string, code: string, overridable = true) {
    super(message)
    this.code = code
    this.overridable = overridable
  }
}

export interface PolicyOverride {
  reason: string
}

export async function getAppointmentPolicy(organizationId: string): Promise<AppointmentPolicyDto> {
  return cached(`appointment-policy:${organizationId}`, { ttlMs: 60_000, tags: [orgTag(organizationId)] }, async () => {
    const row = await prisma.appointmentPolicy.findUnique({ where: { organizationId } })
    return row
      ? {
          enforceBusinessHours: row.enforceBusinessHours,
          minNoticeMinutes: row.minNoticeMinutes,
          maxAdvanceDays: row.maxAdvanceDays,
          rescheduleMinNoticeMinutes: row.rescheduleMinNoticeMinutes,
          maxReschedules: row.maxReschedules,
          toleranceMinutes: row.toleranceMinutes,
        }
      : DEFAULT_APPOINTMENT_POLICY
  })
}

const intIn = (v: unknown, label: string, min: number, max: number): number => {
  const n = Number(v)
  if (!Number.isInteger(n) || n < min || n > max) throw new PolicyError(`${label}: ingresa un número entero entre ${min} y ${max}`, "invalid", false)
  return n
}

export async function saveAppointmentPolicy(organizationId: string, input: Partial<Record<keyof AppointmentPolicyDto, unknown>>): Promise<AppointmentPolicyDto> {
  const current = await getAppointmentPolicy(organizationId)
  const next: AppointmentPolicyDto = {
    enforceBusinessHours: input.enforceBusinessHours !== undefined ? Boolean(input.enforceBusinessHours) : current.enforceBusinessHours,
    minNoticeMinutes: input.minNoticeMinutes !== undefined ? intIn(input.minNoticeMinutes, "Anticipación para agendar", 0, 10_080) : current.minNoticeMinutes,
    maxAdvanceDays: input.maxAdvanceDays !== undefined ? intIn(input.maxAdvanceDays, "Días hacia adelante", 1, 365) : current.maxAdvanceDays,
    rescheduleMinNoticeMinutes:
      input.rescheduleMinNoticeMinutes !== undefined ? intIn(input.rescheduleMinNoticeMinutes, "Tiempo mínimo para reagendar", 0, 10_080) : current.rescheduleMinNoticeMinutes,
    maxReschedules:
      input.maxReschedules === undefined ? current.maxReschedules : input.maxReschedules === null || input.maxReschedules === "" ? null : intIn(input.maxReschedules, "Máximo de reagendas", 0, 20),
    toleranceMinutes: input.toleranceMinutes !== undefined ? intIn(input.toleranceMinutes, "Tolerancia", 0, 240) : current.toleranceMinutes,
  }
  await prisma.appointmentPolicy.upsert({ where: { organizationId }, create: { organizationId, ...next }, update: next })
  invalidateOrg(organizationId)
  return next
}

/** «2 h», «45 min», «1 día»: lectura humana de un tiempo en minutos. */
export function humanMinutes(min: number): string {
  if (min >= 1440 && min % 1440 === 0) return `${min / 1440} ${min === 1440 ? "día" : "días"}`
  if (min >= 60 && min % 60 === 0) return `${min / 60} h`
  if (min >= 60) return `${Math.floor(min / 60)} h ${min % 60} min`
  return `${min} min`
}

type Db = Prisma.TransactionClient | typeof prisma

/** La cita completa debe caber en un tramo del horario de la sucursal, el mismo día. */
export async function assertWithinBusinessHours(organizationId: string, locationId: string | null, startsAt: Date, endsAt: Date, policy: AppointmentPolicyDto, db: Db = prisma) {
  if (!policy.enforceBusinessHours) return
  const location = await db.location.findFirst({
    where: { organizationId, ...(locationId ? { id: locationId } : {}), isActive: true },
    orderBy: { createdAt: "asc" },
    select: { openingScheduleJson: true, timezone: true },
  })
  if (!location?.openingScheduleJson) return
  const schedule = parseSchedule(location.openingScheduleJson)
  // Sin ningún día habilitado = el negocio no ha configurado su horario: no se restringe.
  if (!schedule.some((d) => d.enabled)) return
  const tz = location.timezone || "America/Mexico_City"
  const start = zonedParts(startsAt, tz)
  const end = zonedParts(endsAt, tz)
  const sameDay = start.year === end.year && start.month === end.month && start.day === end.day
  const day = schedule.find((d) => d.day === start.weekday)
  const fits =
    sameDay &&
    day?.enabled &&
    day.slots.some((slot) => {
      const [oh, om] = slot.open.split(":").map(Number)
      const [ch, cm] = slot.close.split(":").map(Number)
      return start.minutes >= oh * 60 + om && end.minutes <= ch * 60 + cm
    })
  if (!fits) throw new PolicyError(`La cita debe quedar dentro del horario del negocio (${formatSchedule(schedule)}).`, "business_hours", false)
}

/** Anticipación mínima y ventana máxima para agendar. */
export function assertBookingWindow(policy: AppointmentPolicyDto, startsAt: Date, override?: PolicyOverride | null, now = new Date()) {
  const ahead = startsAt.getTime() - now.getTime()
  if (ahead > policy.maxAdvanceDays * 86_400_000) {
    throw new PolicyError(`Solo se puede agendar con ${policy.maxAdvanceDays} días de anticipación como máximo.`, "max_advance", false)
  }
  if (!override && ahead < policy.minNoticeMinutes * 60_000) {
    throw new PolicyError(`Se requiere agendar con al menos ${humanMinutes(policy.minNoticeMinutes)} de anticipación.`, "min_notice")
  }
}

/** ¿Puede reagendarse esta cita? (tiempo mínimo antes de la cita y límite de reagendas) */
export function assertCanReschedule(
  policy: AppointmentPolicyDto,
  appointment: { startsAt: Date; checkedInAt: Date | null; rescheduleCount: number },
  override?: PolicyOverride | null,
  now = new Date()
) {
  if (appointment.checkedInAt) throw new PolicyError("El cliente ya llegó: la cita no se puede reagendar.", "checked_in", false)
  if (override) return
  const left = appointment.startsAt.getTime() - now.getTime()
  if (left < policy.rescheduleMinNoticeMinutes * 60_000) {
    throw new PolicyError(`Solo se puede reagendar con al menos ${humanMinutes(policy.rescheduleMinNoticeMinutes)} de anticipación a la cita.`, "reschedule_notice")
  }
  if (policy.maxReschedules !== null && appointment.rescheduleCount >= policy.maxReschedules) {
    throw new PolicyError(`Esta cita ya se reagendó ${appointment.rescheduleCount} ${appointment.rescheduleCount === 1 ? "vez" : "veces"}: ese es el máximo permitido.`, "reschedule_limit")
  }
}

export interface AppointmentEventInput {
  organizationId: string
  appointmentId: string
  type: "created" | "rescheduled" | "status" | "checked_in" | "auto_no_show" | "override"
  fromStartsAt?: Date | null
  toStartsAt?: Date | null
  fromStatus?: string | null
  toStatus?: string | null
  actorUserId?: string | null
  reason?: string | null
}

export function recordAppointmentEvent(db: Db, e: AppointmentEventInput) {
  return db.appointmentEvent.create({
    data: {
      organizationId: e.organizationId,
      appointmentId: e.appointmentId,
      type: e.type,
      fromStartsAt: e.fromStartsAt ?? null,
      toStartsAt: e.toStartsAt ?? null,
      fromStatus: e.fromStatus ?? null,
      toStatus: e.toStatus ?? null,
      actorUserId: e.actorUserId ?? null,
      reason: e.reason?.slice(0, 190) ?? null,
    },
  })
}

export async function getAppointmentHistory(organizationId: string, appointmentId: string) {
  const rows = await prisma.appointmentEvent.findMany({
    where: { organizationId, appointmentId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      fromStartsAt: true,
      toStartsAt: true,
      fromStatus: true,
      toStatus: true,
      reason: true,
      createdAt: true,
      actor: { select: { fullName: true } },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    fromStartsAt: r.fromStartsAt?.toISOString() ?? null,
    toStartsAt: r.toStartsAt?.toISOString() ?? null,
    fromStatus: r.fromStatus,
    toStatus: r.toStatus,
    reason: r.reason,
    at: r.createdAt.toISOString(),
    actor: r.actor?.fullName ?? null,
  }))
}

/**
 * Pierde las citas cuya hora + tolerancia ya pasó sin que el cliente llegara. Se ejecuta cada minuto en
 * segundo plano y al abrir la agenda; es idempotente (solo toca pending/confirmed sin llegada).
 */
export async function sweepLateAppointments(organizationId?: string, now = new Date()): Promise<number> {
  const horizon = new Date(now.getTime() - 3 * 86_400_000)
  const candidates = await prisma.appointment.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      status: { in: ["pending", "confirmed"] },
      checkedInAt: null,
      startsAt: { lt: now, gt: horizon },
    },
    select: { id: true, organizationId: true, startsAt: true, status: true },
    take: 500,
  })
  let lost = 0
  const tolerance = new Map<string, number>()
  for (const c of candidates) {
    if (!tolerance.has(c.organizationId)) tolerance.set(c.organizationId, (await getAppointmentPolicy(c.organizationId)).toleranceMinutes)
    if (now.getTime() <= c.startsAt.getTime() + tolerance.get(c.organizationId)! * 60_000) continue
    const claimed = await prisma.appointment.updateMany({
      where: { id: c.id, status: c.status, checkedInAt: null },
      data: { status: "no_show" },
    })
    if (claimed.count !== 1) continue
    lost += 1
    await recordAppointmentEvent(prisma, {
      organizationId: c.organizationId,
      appointmentId: c.id,
      type: "auto_no_show",
      fromStatus: c.status,
      toStatus: "no_show",
      reason: `Pasó la tolerancia de ${humanMinutes(tolerance.get(c.organizationId)!)} sin que el cliente llegara`,
    })
  }
  return lost
}
