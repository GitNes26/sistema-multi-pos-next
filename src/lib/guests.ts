// «Pedir para varias personas»: cada renglón puede llevar el nombre de a quién
// pertenece, para que quien prepara y quien entrega sepa de quién es cada plato.

export const MAX_GUEST_NAME = 60

/** Nombre limpio (sin espacios de más) o null si viene vacío. */
export function cleanGuestName(value: unknown): string | null {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : ""
  return text ? text.slice(0, MAX_GUEST_NAME) : null
}

export interface GuestGroup<T> {
  /** Nombre de la persona; null = renglones sin asignar. */
  guest: string | null
  items: T[]
}

/**
 * Agrupa por persona conservando el orden de aparición. Solo agrupa si hay al
 * menos un nombre; si no, devuelve un único grupo sin nombre (vista normal).
 */
export function groupByGuest<T>(items: T[], guestOf: (item: T) => string | null | undefined): GuestGroup<T>[] {
  const named = items.some((i) => cleanGuestName(guestOf(i)))
  if (!named) return [{ guest: null, items }]
  const groups: GuestGroup<T>[] = []
  for (const item of items) {
    const guest = cleanGuestName(guestOf(item))
    const found = groups.find((g) => (g.guest ?? "").toLowerCase() === (guest ?? "").toLowerCase() && (g.guest === null) === (guest === null))
    if (found) found.items.push(item)
    else groups.push({ guest, items: [item] })
  }
  return groups
}

/** ¿El pedido reparte renglones entre varias personas? */
export function hasGuests<T>(items: T[], guestOf: (item: T) => string | null | undefined): boolean {
  return items.some((i) => cleanGuestName(guestOf(i)))
}
