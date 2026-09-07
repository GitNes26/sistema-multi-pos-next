// SSE pub/sub for real-time KDS order updates.
// Channel keyed by organizationId; broadcast on every order/item status change.

type Controller = ReadableStreamDefaultController<Uint8Array>;

export interface KdsUpdatePayload {
  type: "order_new" | "order_updated" | "order_removed" | "reservations_changed";
  orderId?: string;
  orderNumber?: string | number;
  status?: string;
  locationId?: string | null;
  table?: { id: string; number: number; name: string | null } | null;
  elapsedSeconds?: number;
  items?: {
    id: string;
    productName: string;
    variantName: string | null;
    quantity: number | string;
    itemStatus: string;
  }[];
}

// En dev, turbopack evalúa los módulos por ruta: sin el singleton en
// globalThis, el route del stream y el route que difunde llevarían Maps
// distintos y los eventos nunca cruzarían de un módulo al otro.
const globalForKdsLive = globalThis as unknown as {
  kdsChannels: Map<string, Set<Controller>> | undefined;
};
const channels = globalForKdsLive.kdsChannels ?? new Map<string, Set<Controller>>();
if (process.env.NODE_ENV !== "production") globalForKdsLive.kdsChannels = channels;

const encoder = new TextEncoder();

function okChunk(obj: unknown) {
  return encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
}

/** Subscribe a controller to the org's KDS channel. Returns an unsubscribe function. */
export function openKdsChannel(organizationId: string, controller: Controller) {
  let set = channels.get(organizationId);
  if (!set) {
    set = new Set();
    channels.set(organizationId, set);
  }
  set.add(controller);
  return () => {
    set?.delete(controller);
    if (set?.size === 0) channels.delete(organizationId);
  };
}

/** Broadcast a KDS update to all subscribers of the given organization. */
export function broadcastKdsUpdate(organizationId: string, payload: KdsUpdatePayload) {
  const set = channels.get(organizationId);
  if (!set || set.size === 0) return;
  const chunk = okChunk(payload);
  for (const ctrl of set) {
    try {
      ctrl.enqueue(chunk);
    } catch {
      set.delete(ctrl);
    }
  }
}
