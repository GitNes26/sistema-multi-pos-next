// SSE pub/sub for real-time table status updates in the POS.
// Channel keyed by organizationId; broadcast on every table status change.

type Controller = ReadableStreamDefaultController<Uint8Array>;

export interface TableUpdatePayload {
  id: string;
  number: number;
  name: string | null;
  capacity: number | null;
  status: string;
  room?: { id: string; name: string } | null;
  location: { name: string } | null;
  updatedAt: string;
  // Aviso de llegada: reservación confirmada próxima de la mesa (o null).
  upcomingReservation?: { guests: number; startsAt: string } | null;
}

// Singleton en globalThis (misma razón que lib/kds/live.ts en dev).
const globalForTablesLive = globalThis as unknown as {
  tableChannels: Map<string, Set<Controller>> | undefined;
};
const channels = globalForTablesLive.tableChannels ?? new Map<string, Set<Controller>>();
if (process.env.NODE_ENV !== "production") globalForTablesLive.tableChannels = channels;
const encoder = new TextEncoder();

import { safeJson } from "@/lib/api-helpers";

function okChunk(obj: unknown) {
  return encoder.encode(`data: ${JSON.stringify(safeJson(obj))}\n\n`);
}

/** Subscribe a controller to the org's table-update channel. Returns an unsubscribe function. */
export function openTableChannel(organizationId: string, controller: Controller) {
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

/** Broadcast a table update to all subscribers of the given organization. */
export function broadcastTableUpdate(organizationId: string, payload: TableUpdatePayload) {
  // Barridos de la lista de espera: corran aunque no haya suscriptores SSE
  // (el emparejamiento y el aviso al invitado no dependen del stream).
  // Import dinámico para no crear ciclo tables/live ↔ tables/waitlist.
  if (payload.status === "free") {
    import("@/lib/tables/waitlist")
      .then((m) => m.sweepTableWaitlist(organizationId))
      .catch((err) => console.error("[waitlist] sweep failed:", err));
  }

  // Mesa ocupada/reservada → si estaba ofrecida a alguien de la lista de
  // espera, reclamamos la oferta: avisamos al invitado y lo re-emparejamos
  // con la siguiente mesa libre.
  if (payload.status === "occupied" || payload.status === "reserved") {
    import("@/lib/tables/waitlist")
      .then((m) => m.reclaimTakenOffers(organizationId))
      .catch((err) => console.error("[waitlist] reclaim failed:", err));
  }

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
