// Tipos del tablero de órdenes de servicio compartidos entre componentes cliente (sin prisma).

export interface FlowStage {
  id: string
  label: string
  notifyCustomer: boolean
  isReady: boolean
}

export interface Flow {
  id: string
  name: string
  description: string | null
  isDefault: boolean
  isActive: boolean
  stages: FlowStage[]
  productIds: string[]
}

export interface ServiceOrder {
  id: string
  number: number
  status: "open" | "ready" | "delivered" | "cancelled"
  keyTag: string | null
  indications: string | null
  promisedAt: string | null
  readyAt: string | null
  deliveredAt: string | null
  createdAt: string
  total: number
  saleId: string | null
  customer: { id: string; fullName: string; phone: string | null } | null
  asset: { id: string; label: string; reference: string | null; size: string | null } | null
  station: { id: string; name: string } | null
  employee: { id: string; fullName: string } | null
  flow: { id: string; name: string }
  stage: { id: string; label: string; isReady: boolean }
  items: { id: string; productName: string; variantName: string | null; quantity: number; unitPrice: number; lineTotal: number }[]
}

export interface OrderEvent {
  id: string
  type: string
  detail: string | null
  at: string
  actor: string | null
}

export interface CatalogService {
  variantId: string
  productId: string
  name: string
  variantName: string | null
  price: number
}

export const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" })

/** «hace 25 min», «hace 2 h 10 min». */
export function elapsed(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return `${h} h${min % 60 ? ` ${min % 60} min` : ""}`
}

export const EVENT_LABEL: Record<string, string> = {
  created: "Ingreso",
  stage: "Etapa",
  station: "Lugar",
  key: "Llavero",
  notified: "Aviso al cliente",
  delivered: "Entrega y cobro",
  cancelled: "Cancelada",
  note: "Nota",
}
