// FASE 8.9/11 — Registro en memoria de canales SSE por organización (pub/sub).

import { publish, subscribe, subscriberCount } from "@/lib/realtime";

type Controller = ReadableStreamDefaultController<Uint8Array>;

/** payload de notificación tal como lo espera el hook cliente. */
export interface LiveNotificationPayload {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  sound?: string;
  href?: string;
  read: boolean;
  createdAt: string;
}

const channel = (key: string) => `notifications:${key}`;

export function openOrgChannel(organizationId: string, controller: Controller) {
  return subscribe(channel(organizationId), controller);
}

export function openUserChannel(organizationId: string, userId: string, controller: Controller) {
  return openOrgChannel(`${organizationId}:${userId}`, controller);
}

export function broadcastToUser(organizationId: string, userId: string, payload: LiveNotificationPayload) {
  broadcastToOrg(`${organizationId}:${userId}`, payload);
}

/** Envía solo a esta conexión (instantánea inicial al conectar). */
export function sendItems(controller: Controller, items: LiveNotificationPayload[]) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ items })}

`));
}

export function broadcastToOrg(organizationId: string, payload: LiveNotificationPayload) {
  publish(channel(organizationId), payload);
}

export function broadcastItems(organizationId: string, items: LiveNotificationPayload[]) {
  publish(channel(organizationId), { items });
}

export function orgChannelCount(organizationId: string): number {
  return subscriberCount(channel(organizationId));
}
