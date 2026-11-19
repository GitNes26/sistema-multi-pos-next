// Empresas demo / prueba gratis: se configuran como si estuvieran pagadas (plan, capacidad, módulos) y
// se muestra lo que costarían, pero no se cobran ni cuentan en los ingresos del control de suscripciones.
// El fin de la prueba es `periodEndsAt`; al llegar se suspende como cualquier suscripción vencida.

const DAY_MS = 86_400_000
/** A partir de aquí la prueba se considera permanente (empresas internas como NESSIK Test). */
export const PERMANENT_DEMO_DAYS = 3650

export type BillingPlanPrices = { monthlyPrice: unknown; extraLocationPrice: unknown; extraEmployeePackPrice: unknown }

/** Días de calendario que faltan hasta `endsAt` (0 = termina hoy, negativo si ya pasó). */
export function daysUntil(endsAt: Date | string, now: Date = new Date()): number {
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((day(new Date(endsAt)) - day(now)) / DAY_MS)
}

/** Fin de una prueba de `days` días contados desde `now` (último instante del día). */
export function demoPeriodEnd(days: number, now: Date = new Date()): Date {
  const n = Math.max(1, Math.min(PERMANENT_DEMO_DAYS, Math.floor(Number(days) || 0)))
  const end = new Date(now)
  end.setDate(end.getDate() + n)
  end.setHours(23, 59, 59, 0)
  return end
}

/** Mensualidad que pagaría la empresa con esta configuración (plan base + capacidad extra). */
export function monthlyCost(plan: BillingPlanPrices, extraLocations: number, extraEmployeePacks: number): number {
  return Number(plan.monthlyPrice) + extraLocations * Number(plan.extraLocationPrice) + extraEmployeePacks * Number(plan.extraEmployeePackPrice)
}

export type DemoPhase = "permanent" | "running" | "last_days" | "ended"

/** Estado de la prueba: permanente, en curso, últimos 3 días o terminada. */
export function demoPhase(endsAt: Date | string, now: Date = new Date()): DemoPhase {
  const days = daysUntil(endsAt, now)
  if (days > PERMANENT_DEMO_DAYS) return "permanent"
  if (days < 0) return "ended"
  return days <= 3 ? "last_days" : "running"
}

/** Texto corto para la empresa: «Te quedan 9 días de prueba gratis». */
export function demoLabel(endsAt: Date | string, now: Date = new Date()): string {
  const phase = demoPhase(endsAt, now)
  if (phase === "permanent") return "Empresa demo: uso sin costo"
  const days = daysUntil(endsAt, now)
  if (phase === "ended") return "Tu prueba gratis terminó"
  if (days === 0) return "Tu prueba gratis termina hoy"
  return `Te ${days === 1 ? "queda" : "quedan"} ${days} ${days === 1 ? "día" : "días"} de prueba gratis`
}
