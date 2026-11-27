// Periodos de suscripción: inicio + frecuencia de pago (en meses) = vencimiento.
// Las fechas se manejan como día de calendario «YYYY-MM-DD». El inicio se guarda
// a mediodía UTC y el vencimiento al final del día UTC, para que el día no cambie
// por la zona horaria y la empresa no pierda el acceso a media jornada.

/** Frecuencias habituales; además se admite cualquier número entero de meses. */
export const BILLING_FREQUENCIES = [1, 2, 3, 6, 12] as const
export const MAX_BILLING_MONTHS = 120

export function billingLabel(months: number | null | undefined): string {
  if (!months) return "Fecha manual"
  if (months % 12 === 0) return months === 12 ? "Cada año" : `Cada ${months / 12} años`
  return months === 1 ? "Cada mes" : `Cada ${months} meses`
}

/** Suma meses a un día; si el mes destino es más corto usa su último día (31 ene + 1 = 28/29 feb). */
export function addMonthsYmd(ymd: string, months: number): string {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number)
  if (!y || !m || !d) return ""
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}

/**
 * Convierte el día capturado en la fecha a guardar. Si el día no cambió respecto
 * a la fecha ya guardada, la conserva intacta (no altera la hora de datos reales).
 */
export function resolveBillingDate(input: unknown, current?: Date | null, boundary: "start" | "end" = "start"): Date | null {
  const text = String(input ?? "").slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null
  if (current && current.toISOString().slice(0, 10) === text) return current
  const date = new Date(`${text}T${boundary === "end" ? "23:59:59" : "12:00:00"}.000Z`)
  // Rechaza días inexistentes (31 de febrero).
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text ? null : date
}

/** Meses válidos (entero de 1 a 120) o null = el vencimiento se captura a mano. */
export function parseBillingMonths(value: unknown): number | null {
  if (value === null || value === "" || value === undefined) return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1 || n > MAX_BILLING_MONTHS) throw new Error(`La frecuencia de pago debe ser de 1 a ${MAX_BILLING_MONTHS} meses`)
  return n
}
