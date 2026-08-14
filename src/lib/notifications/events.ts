import { persistNotification } from "@/lib/notifications/helpers";
import { money } from "@/lib/pos/money";

// FASE 11.6 — Notificaciones por evento.
// Cada helper persiste + emite por SSE la notificación con su sonido/icono,
// vinculando al empleado que originó el evento (11.7).

export interface EventCtx {
  userId?: string | null;
  employeeId?: string | null;
}

/** Venta completada en el POS (11.6). */
export async function notifySaleCompleted(
  organizationId: string,
  locationId: string,
  ctx: EventCtx,
  sale: { locationSaleNumber: number | null; saleNumber: string; total: number; locationName: string }
) {
  await persistNotification({
    organizationId,
    locationId,
    userId: ctx.userId ?? null,
    employeeId: ctx.employeeId ?? null,
    kind: "sale",
    severity: "success",
    title: "Venta completada",
    body: `#${Number(sale.locationSaleNumber) ?? sale.saleNumber} por ${money(sale.total)} — ${sale.locationName}`,
    link: "/admin/sales",
    metadata: { event: "sale" },
  });
}

/**
 * Eventos de pedidos (nuevo, listo, entregado, cancelado).
 * Se invocan desde FASE 12/13 cuando exista el flujo de pedidos.
 */
export async function notifyOrderEvent(
  organizationId: string,
  locationId: string | null,
  ctx: EventCtx,
  order: {
    orderNumber: string | number;
    status: string;
    customerName?: string | null;
    total: number;
  }
) {
  const config: Record<
    string,
    { title: string; severity: string; icon: string; sound: string }
  > = {
    pending: { title: "Nuevo pedido en línea", severity: "info", icon: "order-received", sound: "order-received" },
    confirmed: { title: "Pedido confirmado", severity: "info", icon: "order-received", sound: "notification" },
    preparing: { title: "Pedido en preparación", severity: "info", icon: "order-received", sound: "notification" },
    ready: { title: "Pedido listo", severity: "success", icon: "order-ready", sound: "order-ready" },
    delivered: { title: "Pedido entregado", severity: "success", icon: "order-ready", sound: "notification" },
    cancelled: { title: "Pedido cancelado", severity: "warning", icon: "notification", sound: "error" },
  };
  const c = config[order.status] ?? config.pending;
  const who = order.customerName ? ` de ${order.customerName}` : "";
  await persistNotification({
    organizationId,
    locationId: locationId ?? null,
    userId: ctx.userId ?? null,
    employeeId: ctx.employeeId ?? null,
    kind: "order",
    severity: c.severity,
    title: c.title,
    body: `#${order.orderNumber}${who} por ${money(order.total)}`,
    link: "/admin/orders",
    metadata: { event: "order", status: order.status, sound: c.sound },
  });
}
