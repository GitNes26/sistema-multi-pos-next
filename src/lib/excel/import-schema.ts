export type ImportCell = string | number | boolean | null

export const IMPORT_MAX_ROWS = 5000
export const IMPORT_MAX_COLUMNS = 60

export function normalizedText(value: unknown) {
  return String(value ?? "").trim()
}

export function normalizedKey(value: unknown) {
  return normalizedText(value).toLocaleLowerCase("es-MX")
}

export function parseBoolean(value: unknown): boolean | undefined {
  const key = normalizedKey(value)
  if (["1", "si", "sí", "true", "activo", "activa", "yes"].includes(key)) return true
  if (["0", "no", "false", "inactivo", "inactiva"].includes(key)) return false
  return undefined
}

export function parseOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || normalizedText(value) === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

export function validateEmail(value: unknown) {
  const text = normalizedText(value)
  return !text || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)
}

export function validatePhone(value: unknown) {
  const text = normalizedText(value)
  return !text || /^\d{10}$/.test(text)
}

export function duplicateValues(values: unknown[]) {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    const key = normalizedKey(value)
    if (!key) continue
    if (seen.has(key)) duplicates.add(key)
    seen.add(key)
  }
  return duplicates
}
