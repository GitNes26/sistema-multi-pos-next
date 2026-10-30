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

import { safeJson } from "@/lib/api-helpers";
import { publish, subscribe } from "@/lib/realtime";

const channel = (organizationId: string) => `tables:${organizationId}`;

/** Subscribe a controller to the org's table-update channel. Returns an unsubscribe function. */
export function openTableChannel(organizationId: string, controller: Controller) {
  return subscribe(channel(organizationId), controller);
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

  publish(channel(organizationId), safeJson(payload));
}
