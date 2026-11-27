import { normalizeSearch } from "@/lib/search"

export const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"] as const

/**
 * Mes escrito a mano → 0..11. Acepta número (1-12) o el inicio del nombre
 * («ago», «Septiembre»). Si el texto es ambiguo («ju», «ma») devuelve null.
 */
export function parseMonthText(text: string): number | null {
  const value = normalizeSearch(text).trim()
  if (!value) return null
  if (/^\d+$/.test(value)) {
    const n = Number(value)
    return n >= 1 && n <= 12 ? n - 1 : null
  }
  const matches = MONTH_NAMES.map((name, index) => (name.startsWith(value) ? index : -1)).filter((index) => index >= 0)
  return matches.length === 1 ? matches[0] : null
}
