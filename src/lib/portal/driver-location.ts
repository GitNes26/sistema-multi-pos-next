// In-memory driver location tracking for real-time delivery map.
// Drivers POST location updates; customers subscribe via SSE.

type Controller = ReadableStreamDefaultController<Uint8Array>;

export interface DriverLocation {
  orderId: string;
  lat: number;
  lng: number;
  updatedAt: string;
}

// Ambos mapas viven en globalThis: en dev cada ruta compila su propia instancia
// del módulo, y un Map a nivel de módulo haría que el POST del repartidor
// escriba en una copia y el SSE del cliente lea de otra (replay vacío).
const globalForDriverLive = globalThis as unknown as {
  driverLocations: Map<string, DriverLocation> | undefined;
  driverChannels: Map<string, Set<Controller>> | undefined;
};
const locations = globalForDriverLive.driverLocations ?? new Map<string, DriverLocation>();
if (process.env.NODE_ENV !== "production") globalForDriverLive.driverLocations = locations;
const channels = globalForDriverLive.driverChannels ?? new Map<string, Set<Controller>>();
if (process.env.NODE_ENV !== "production") globalForDriverLive.driverChannels = channels;
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
