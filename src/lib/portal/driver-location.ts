// In-memory driver location tracking for real-time delivery map.
// Drivers POST location updates; customers subscribe via SSE.

type Controller = ReadableStreamDefaultController<Uint8Array>;

export interface DriverLocation {
  orderId: string;
  lat: number;
  lng: number;
  updatedAt: string;
}

const locations = new Map<string, DriverLocation>();
const channels = new Map<string, Set<Controller>>();
const encoder = new TextEncoder();

function okChunk(obj: unknown) {
  return encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
}

/** Driver reports their current location. */
export function updateDriverLocation(payload: DriverLocation) {
  locations.set(payload.orderId, payload);
  const set = channels.get(payload.orderId);
  if (!set || set.size === 0) return;
  const chunk = okChunk(payload);
  for (const ctrl of set) {
    try { ctrl.enqueue(chunk); } catch { set.delete(ctrl); }
  }
}

/** Customer subscribes to driver location for an order. */
export function openDriverLocationChannel(orderId: string, controller: Controller) {
  let set = channels.get(orderId);
  if (!set) { set = new Set(); channels.set(orderId, set); }
  set.add(controller);

  // Send current location immediately if available
  const current = locations.get(orderId);
  if (current) {
    try { controller.enqueue(okChunk(current)); } catch { /* ignore */ }
  }

  return () => {
    set?.delete(controller);
    if (set?.size === 0) channels.delete(orderId);
  };
}

/** Get current driver location (for initial load). */
export function getDriverLocation(orderId: string): DriverLocation | null {
  return locations.get(orderId) ?? null;
}
