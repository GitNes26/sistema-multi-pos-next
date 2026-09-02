// SSE pub/sub for real-time table status updates in the POS.
// Channel keyed by organizationId; broadcast on every table status change.

type Controller = ReadableStreamDefaultController<Uint8Array>;

export interface TableUpdatePayload {
  id: string;
  number: number;
  name: string | null;
  capacity: number | null;
  status: string;
  location: { name: string } | null;
  updatedAt: string;
}

const channels = new Map<string, Set<Controller>>();
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
