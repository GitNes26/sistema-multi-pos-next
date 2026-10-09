import { usePosStore, ticketContextKey } from "@/stores/pos-store"
import { rebuildKitchenLines, type KitchenOrderItemDto } from "@/lib/pos/kitchen-ticket"

// Alternar entre cuentas abiertas del POS (mesas y pedidos para llevar). La parte ya enviada a
// cocina vive en el servidor (comanda abierta); lo que aún no se envía se pausa en el navegador.

export interface OpenAccount {
  id: string
  orderNumber: number
  status: string
  serviceType: string | null
  total: number
  items: number
  createdAt: string
  table: { id: string; number: number; name: string | null } | null
}

type Target =
  | { type: "table"; table: { id: string; number: number; name?: string | null } }
  | { type: "takeaway"; orderId: string | null; orderNumber?: number }

function labelOf(s: ReturnType<typeof usePosStore.getState>) {
  if (s.serviceType === "takeaway") return s.kitchenOrderId ? "Para llevar" : "Nuevo para llevar"
  return s.selectedTable ? `Mesa ${s.selectedTable.number}` : "Ticket"
}

/** Carrito armado por los comensales desde el QR de una mesa (aún sin enviar a cocina). */
export interface QrCart {
  tableId: string
  number: number
  name: string | null
  count: number
  total: number
}

/** Cuentas abiertas del local (mesas y para llevar) con su total, y carritos QR pendientes. */
export async function fetchOpenAccounts(locationId?: string): Promise<{ orders: OpenAccount[]; carts: QrCart[] }> {
  try {
    const qs = new URLSearchParams({ open: "1" })
    if (locationId) qs.set("locationId", locationId)
    const res = await fetch(`/api/pos/kitchen?${qs}`, { cache: "no-store" })
    const data = await res.json().catch(() => ({}))
    return data.ok ? { orders: data.orders as OpenAccount[], carts: (data.carts ?? []) as QrCart[] } : { orders: [], carts: [] }
  } catch {
    return { orders: [], carts: [] }
  }
}

/**
 * Pausa la cuenta actual y abre otra. Devuelve cuántos artículos ya enviados se recargaron.
 * Si la cuenta destino tenía borrador (artículos sin enviar, descuento, cliente), se restaura.
 */
export async function switchTicket(target: Target): Promise<number> {
  const store = usePosStore
  const before = store.getState()
  const currentKey = ticketContextKey(before)
  if (currentKey !== "none") before.stashTicket(currentKey, labelOf(before))

  store.getState().resetWorkingTicket()
  if (target.type === "table") {
    usePosStore.setState({ serviceType: "dine_in", selectedTable: target.table, kitchenOrderId: null })
  } else {
    usePosStore.setState({ serviceType: "takeaway", selectedTable: null, kitchenOrderId: target.orderId })
  }

  let loaded = 0
  const isManual = target.type === "table" && target.table.id.startsWith("manual-")
  if (!isManual && !(target.type === "takeaway" && !target.orderId)) {
    try {
      const qs = target.type === "table" ? `tableId=${target.table.id}` : `orderId=${target.orderId}`
      const res = await fetch(`/api/pos/kitchen?${qs}&full=1`, { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (data.ok && data.order) {
        const lines = rebuildKitchenLines(data.order.items as KitchenOrderItemDto[], usePosStore.getState().products)
        if (lines.length) {
          usePosStore.getState().prependSentLines(lines)
          loaded = lines.length
        }
        if (data.order.customerId) usePosStore.getState().setCustomer(data.order.customerId)
        if (target.type === "takeaway" && data.order.id) usePosStore.getState().setKitchenOrderId(data.order.id)
      }
    } catch {
      /* sin conexión: queda como cuenta nueva */
    }
  }

  const key = ticketContextKey(usePosStore.getState())
  const held = usePosStore.getState().takeHeld(key)
  if (held) {
    usePosStore.setState((s) => ({
      items: [...s.items, ...held.items],
      customerId: held.customerId ?? s.customerId,
      manualDiscount: held.manualDiscount,
      coupon: held.coupon,
      pointsRedeemed: held.pointsRedeemed,
    }))
    usePosStore.getState().dropHeld(key)
  }
  return loaded
}

/** Pausa la cuenta actual y abre un ticket en blanco para llevar. */
export async function startNewTakeaway() {
  return switchTicket({ type: "takeaway", orderId: null })
}
