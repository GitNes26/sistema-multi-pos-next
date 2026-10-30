// Avisos en vivo (SSE): un solo registro de conexiones y un solo punto de difusión.
// Hoy todo es en memoria de la instancia. Para varias instancias, implementar
// `RealtimeDriver` (p. ej. Redis pub/sub) y llamar `setRealtimeDriver`: cada instancia
// reenvía a sus conexiones locales con `deliverLocal`.

export type RealtimeController = ReadableStreamDefaultController<Uint8Array>;

export interface RealtimeDriver {
  /** Publica en el medio compartido; quien reciba debe llamar `deliverLocal(channel, data)`. */
  publish(channel: string, data: unknown): void;
}

// En dev, turbopack evalúa los módulos por ruta: el singleton en globalThis evita que el
// stream y quien difunde lleven registros distintos.
const g = globalThis as unknown as {
  realtimeChannels: Map<string, Set<RealtimeController>> | undefined;
  realtimeDriver: RealtimeDriver | null | undefined;
};
const channels = g.realtimeChannels ?? new Map<string, Set<RealtimeController>>();
if (process.env.NODE_ENV !== "production") g.realtimeChannels = channels;

const encoder = new TextEncoder();

export function setRealtimeDriver(driver: RealtimeDriver | null) {
  g.realtimeDriver = driver;
}

/** Suscribe una conexión SSE a un canal. Devuelve la función para darla de baja. */
export function subscribe(channel: string, controller: RealtimeController) {
  let set = channels.get(channel);
  if (!set) {
    set = new Set();
    channels.set(channel, set);
  }
  set.add(controller);
  return () => {
    set?.delete(controller);
    if (set?.size === 0) channels.delete(channel);
  };
}

/** Escribe `data` solo en las conexiones de esta instancia. */
export function deliverLocal(channel: string, data: unknown) {
  const set = channels.get(channel);
  if (!set || set.size === 0) return;
  const chunk = encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  for (const ctrl of set) {
    try {
      ctrl.enqueue(chunk);
    } catch {
      set.delete(ctrl);
    }
  }
}

/** Difunde `data` a todos los suscriptores del canal, de esta instancia y de las demás. */
export function publish(channel: string, data: unknown) {
  deliverLocal(channel, data);
  try {
    g.realtimeDriver?.publish(channel, data);
  } catch (err) {
    console.error("[realtime] publish failed:", err);
  }
}

/** Conexiones abiertas en esta instancia para el canal. */
export function subscriberCount(channel: string): number {
  return channels.get(channel)?.size ?? 0;
}
