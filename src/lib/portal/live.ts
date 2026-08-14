// FASE 13.7 — Canales SSE por pedido para el tracking en tiempo real del portal.

type Controller = ReadableStreamDefaultController<Uint8Array>;

export interface OrderStatusPayload {
  orderId: string;
  orderNumber: number;
  status: string;
  updatedAt: string;
}

const channels = new Map<string, Set<Controller>>();
const encoder = new TextEncoder();

function okChunk(obj: unknown) {
  return encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export function openOrderChannel(orderId: string, controller: Controller) {
  let set = channels.get(orderId);
  if (!set) {
    set = new Set();
    channels.set(orderId, set);
  }
  set.add(controller);
  return () => {
    set?.delete(controller);
    if (set?.size === 0) channels.delete(orderId);
  };
}

export function broadcastOrderStatus(payload: OrderStatusPayload) {
  const set = channels.get(payload.orderId);
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
