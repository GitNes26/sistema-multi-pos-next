import { prisma } from "@/lib/db"
import { CrudError } from "@/lib/crud/types"
import { getDeliveryPolicy } from "@/lib/orders/server"
import { isScheduleOpenNow, nextOpening, parseSchedule, tomorrowOpening, type DaySchedule } from "@/lib/schedule"

// Abierto / Cerrado del negocio.
//   1) Cierre temporal (imprevistos): lo activa el negocio con el switch y
//      reabre solo en la fecha elegida (o al abrir manualmente).
//   2) Si no hay cierre temporal, manda el horario de servicio (el mismo que
//      valida los pedidos del portal).
// El portal lo muestra siempre y no acepta pedidos durante un cierre temporal.

export type CloseMode = "next_business_day" | "tomorrow" | "until" | "manual"

export interface StoreStatus {
  open: boolean
  /** manual = cierre temporal · schedule = por horario · always = sin horario */
  source: "manual" | "schedule" | "always"
  /** Texto corto para el badge ("Abierto hasta 22:00", "Cerrado · abre lun 9:00"). */
  label: string
  /** Aviso del negocio durante un cierre temporal. */
  reason: string | null
  /** Próxima apertura (ISO) si se conoce. */
  reopensAt: string | null
  closedAt: string | null
  timezone: string
  /** ¿El portal recibe pedidos ahora? (con horario de pedidos o cierre temporal, no). */
  acceptsOrders: boolean
}

export const DEFAULT_CLOSED_REASON = "Cerramos temporalmente. Gracias por tu comprensión."

async function businessSchedule(organizationId: string): Promise<{ schedule: DaySchedule[] | null; timezone: string; ordersFollowSchedule: boolean }> {
  const [policy, location] = await Promise.all([
    getDeliveryPolicy(organizationId),
    prisma.location.findFirst({
      where: { organizationId, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { timezone: true, openingScheduleJson: true },
    }),
  ])
  const schedule =
    (policy?.pickupSchedule?.length ? parseSchedule(policy.pickupSchedule) : null) ??
    (policy?.deliverySchedule?.length ? parseSchedule(policy.deliverySchedule) : null) ??
    (location?.openingScheduleJson ? parseSchedule(location.openingScheduleJson) : null)
  // Si el horario viene de la política de pedidos, fuera de él no se reciben pedidos;
  // si solo es el horario de la sucursal, se puede pedir y se prepara al abrir.
  const ordersFollowSchedule = Boolean(policy?.pickupSchedule?.length || policy?.deliverySchedule?.length)
  return { schedule, timezone: location?.timezone || "America/Mexico_City", ordersFollowSchedule }
}

const whenLabel = (date: Date, timezone: string) => {
  const now = new Date()
  const sameDay = date.toLocaleDateString("es-MX", { timeZone: timezone }) === now.toLocaleDateString("es-MX", { timeZone: timezone })
  const time = date.toLocaleTimeString("es-MX", { timeZone: timezone, hour: "2-digit", minute: "2-digit" })
  if (sameDay) return `hoy ${time}`
  const tomorrow = new Date(now.getTime() + 86400000)
  if (date.toLocaleDateString("es-MX", { timeZone: timezone }) === tomorrow.toLocaleDateString("es-MX", { timeZone: timezone })) return `mañana ${time}`
  return `${date.toLocaleDateString("es-MX", { timeZone: timezone, weekday: "short", day: "numeric", month: "short" })} ${time}`
}

export async function getStoreStatus(organizationId: string): Promise<StoreStatus> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { closedManually: true, closedUntil: true, closedReason: true, closedAt: true },
  })
  const { schedule, timezone, ordersFollowSchedule } = await businessSchedule(organizationId)
  const now = new Date()

  if (org?.closedManually) {
    if (org.closedUntil && org.closedUntil <= now) {
      // Venció: reabre solo (se limpia para no volver a evaluarlo).
      await prisma.organization.update({ where: { id: organizationId }, data: { closedManually: false, closedUntil: null, closedReason: null, closedAt: null } })
    } else {
      return {
        open: false,
        source: "manual",
        label: org.closedUntil ? `Cerrado · abre ${whenLabel(org.closedUntil, timezone)}` : "Cerrado temporalmente",
        reason: org.closedReason ?? DEFAULT_CLOSED_REASON,
        reopensAt: org.closedUntil?.toISOString() ?? null,
        closedAt: org.closedAt?.toISOString() ?? null,
        timezone,
        acceptsOrders: false,
      }
    }
  }

  if (!schedule?.some((d) => d.enabled)) {
    return { open: true, source: "always", label: "Abierto", reason: null, reopensAt: null, closedAt: null, timezone, acceptsOrders: true }
  }
  const state = isScheduleOpenNow(schedule, timezone)
  if (state.open) {
    return { open: true, source: "schedule", label: state.message, reason: null, reopensAt: null, closedAt: null, timezone, acceptsOrders: true }
  }
  const next = nextOpening(schedule, timezone, now)
  return {
    open: false,
    source: "schedule",
    label: next ? `Cerrado · abre ${whenLabel(next, timezone)}` : "Cerrado",
    reason: null,
    reopensAt: next?.toISOString() ?? null,
    closedAt: null,
    timezone,
    acceptsOrders: !ordersFollowSchedule,
  }
}

/** Fechas de reapertura sugeridas para cada opción (para mostrarlas antes de cerrar). */
export async function closeOptions(organizationId: string) {
  const { schedule, timezone } = await businessSchedule(organizationId)
  const nextBusiness = schedule ? nextOpening(schedule, timezone, new Date(), true) : null
  return {
    timezone,
    nextBusinessDay: (nextBusiness ?? tomorrowOpening(schedule, timezone)).toISOString(),
    tomorrow: tomorrowOpening(schedule, timezone).toISOString(),
  }
}

export async function closeStore(organizationId: string, input: { mode: CloseMode; until?: string | null; reason?: string | null }) {
  const options = await closeOptions(organizationId)
  let closedUntil: Date | null
  switch (input.mode) {
    case "manual":
      closedUntil = null
      break
    case "tomorrow":
      closedUntil = new Date(options.tomorrow)
      break
    case "until": {
      const d = input.until ? new Date(input.until) : null
      if (!d || Number.isNaN(d.getTime())) throw new CrudError("Elige la fecha y hora de reapertura", 400, "until")
      if (d <= new Date()) throw new CrudError("La reapertura debe ser en el futuro", 400, "until")
      closedUntil = d
      break
    }
    default:
      closedUntil = new Date(options.nextBusinessDay)
  }
  const reason = (input.reason ?? "").trim().slice(0, 200) || DEFAULT_CLOSED_REASON
  await prisma.organization.update({
    where: { id: organizationId },
    data: { closedManually: true, closedUntil, closedReason: reason, closedAt: new Date() },
  })
  return getStoreStatus(organizationId)
}

export async function openStore(organizationId: string) {
  await prisma.organization.update({
    where: { id: organizationId },
    data: { closedManually: false, closedUntil: null, closedReason: null, closedAt: null },
  })
  return getStoreStatus(organizationId)
}
