// FASE 13.7 — Canales SSE por pedido para el tracking en tiempo real del portal.

import { publish, subscribe } from "@/lib/realtime";

type Controller = ReadableStreamDefaultController<Uint8Array>;

export interface OrderStatusPayload {
  orderId: string;
  orderNumber: number;
  status: string;
  updatedAt: string;
}

const channel = (orderId: string) => `portal-order:${orderId}`;

export function openOrderChannel(orderId: string, controller: Controller) {
  return subscribe(channel(orderId), controller);
}

export function broadcastOrderStatus(payload: OrderStatusPayload) {
  publish(channel(payload.orderId), payload);
}
