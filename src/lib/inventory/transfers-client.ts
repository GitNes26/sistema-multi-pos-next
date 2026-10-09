// Cliente HTTP del flujo de traslados (sin dependencias de servidor).

export type TransferStatus = "pending" | "preparing" | "in_transit" | "received" | "cancelled"
export type PlaceType = "location" | "cedis"

export interface TransferListRow {
  id: string
  folio: string
  status: TransferStatus
  fromName: string
  toName: string
  fromLocationId: string
  toLocationId: string
  itemCount: number
  totalQty: number
  receivedQty: number | null
  hasDiscrepancy: boolean
  driverName: string | null
  createdAt: string
  dispatchedAt: string | null
  receivedAt: string | null
  expectedAt: string | null
  lastLocationAt: string | null
}

export interface TransferPlace {
  id: string
  type: PlaceType
  name: string
  lat: number | null
  lng: number | null
  address: string | null
}

export interface TransferDetail {
  id: string
  folio: string
  status: TransferStatus
  from: TransferPlace
  to: TransferPlace
  notes: string | null
  receiveNotes: string | null
  receivedBy: string | null
  requestedBy: string | null
  driverName: string | null
  driver: { employeeId: string | null; name: string | null; accepted: boolean; trackToken: string | null }
  vehicle: string | null
  expectedAt: string | null
  hasDiscrepancy: boolean
  lastPosition: { lat: number; lng: number; at: string } | null
  track: { lat: number; lng: number; at: string }[]
  timeline: { key: "requested" | "preparing" | "dispatched" | "received" | "cancelled"; at: string | null; by: string | null }[]
  items: {
    id: string
    productName: string
    variantName: string | null
    image: string | null
    unit: string | null
    quantity: number
    receivedQty: number | null
    receiveNote: string | null
    availableAtOrigin: number | null
  }[]
}

export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  pending: "Solicitado",
  preparing: "En preparación",
  in_transit: "En camino",
  received: "Recibido",
  cancelled: "Cancelado",
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init })
  const data = (await res.json().catch(() => null)) as (T & { ok?: boolean; error?: string }) | null
  if (!res.ok || !data || data.ok === false) throw new Error(data?.error ?? "No se pudo completar la operación")
  return data
}

export const transfersApi = {
  list: (params: { status?: string; locationId?: string; q?: string } = {}) => {
    const sp = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][])
    return json<{ rows: TransferListRow[] }>(`/api/inventory/transfers?${sp}`).then((r) => r.rows)
  },
  get: (id: string) => json<{ transfer: TransferDetail }>(`/api/inventory/transfers/${id}`).then((r) => r.transfer),
  create: (body: {
    fromLocationType: PlaceType
    fromLocationId: string
    toLocationType: PlaceType
    toLocationId: string
    items: { inventoryId: string; quantity: number }[]
    notes?: string
    expectedAt?: string | null
  }) => json<{ id: string; folio: string }>(`/api/inventory/transfers`, { method: "POST", body: JSON.stringify(body) }),
  action: (id: string, body: Record<string, unknown>) =>
    json<{ ok: true; hasDiscrepancy?: boolean }>(`/api/inventory/transfers/${id}`, { method: "POST", body: JSON.stringify(body) }),
  location: (id: string, body: { lat: number; lng: number; accuracy?: number }) =>
    json<{ ok: true }>(`/api/inventory/transfers/${id}/location`, { method: "POST", body: JSON.stringify(body) }),
}
