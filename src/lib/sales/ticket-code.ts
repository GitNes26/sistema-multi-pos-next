const PREFIX = "MP1"

export type TicketCode = { saleId: string }

export function buildTicketCode(value: TicketCode) {
  return [PREFIX, value.saleId].join("|")
}

export function parseTicketCode(value: string): TicketCode | null {
  const normalized = value.trim()
  const [prefix, saleId, extra] = normalized.split("|")
  if (prefix !== PREFIX || extra || !saleId || !/^[A-Za-z0-9_-]+$/.test(saleId)) return null
  return { saleId }
}
