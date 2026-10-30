// SSE pub/sub for real-time KDS order updates.
// Channel keyed by organizationId; broadcast on every order/item status change.

export interface KdsUpdatePayload {
  type:
    | "order_new"
    | "order_updated"
    | "order_removed"
    | "reservations_changed"
    // Nueva reservación PRÓXIMA confirmada (campana del KDS).
    | "reservation_confirmed"
    // El carrito del menú QR de una mesa cambió (status = nº de artículos).
    | "table_cart";
  orderId?: string;
  orderNumber?: string | number;
  status?: string;
  /** «portal» (pedido) o «pos» (comanda de mesa / para llevar). */
  source?: string;
  serviceType?: string | null;
  locationId?: string | null;
  table?: { id: string; number: number; name: string | null } | null;
  elapsedSeconds?: number;
  /** Solo reservation_confirmed: datos del aviso de llegada. */
  startsAt?: string;
  guests?: number;
  guestName?: string | null;
  items?: {
    id: string;
    productName: string;
    variantName: string | null;
    quantity: number | string;
    itemStatus: string;
  }[];
}

import { publish, subscribe } from "@/lib/realtime";

type Controller = ReadableStreamDefaultController<Uint8Array>;

const channel = (organizationId: string) => `kds:${organizationId}`;

/** Subscribe a controller to the org's KDS channel. Returns an unsubscribe function. */
export function openKdsChannel(organizationId: string, controller: Controller) {
  return subscribe(channel(organizationId), controller);
}

/** Broadcast a KDS update to all subscribers of the given organization. */
export function broadcastKdsUpdate(organizationId: string, payload: KdsUpdatePayload) {
  publish(channel(organizationId), payload);
}
