// FASE 8.9/11 — Registro en memoria de canales SSE por organización (pub/sub).

type Controller = ReadableStreamDefaultController<Uint8Array>;

/** payload de notificación tal como lo espera el hook cliente. */
export interface LiveNotificationPayload {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  href?: string;
  read: boolean;
  createdAt: string;
}

const channels = new Map<string, Set<Controller>>();

const encoder = new TextEncoder();

function okChunk(obj: unknown) {
  return encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export function openOrgChannel(organizationId: string, controller: Controller) {
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

export function broadcastToOrg(organizationId: string, payload: LiveNotificationPayload) {
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

export function broadcastItems(organizationId: string, items: LiveNotificationPayload[]) {
  const set = channels.get(organizationId);
  if (!set || set.size === 0) return;
  const chunk = okChunk({ items });
  for (const ctrl of set) {
    try {
      ctrl.enqueue(chunk);
    } catch {
      set.delete(ctrl);
    }
  }
}

export function orgChannelCount(organizationId: string): number {
  return channels.get(organizationId)?.size ?? 0;
}