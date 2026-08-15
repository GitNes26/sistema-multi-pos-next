import type { Notification } from "@prisma/client";
import { prisma } from "@/lib/db";
import { broadcastToOrg, type LiveNotificationPayload } from "@/lib/notifications/live";

// FASE 8.9 — Persistencia + broadcast de notificaciones (stocks bajos y futuras).

const SEVERITY_ICON: Record<string, string> = {
  low_stock: "low-stock",
  warning: "low-stock",
  success: "sale-complete",
  order: "order-received",
  info: "notification",
};

export function notificationToPayload(n: Notification): LiveNotificationPayload {
  const meta = (n.metadata as Record<string, unknown> | null) ?? {};
  const sound = typeof meta.sound === "string" ? meta.sound : undefined;
  return {
    id: n.id,
    title: n.title,
    description: n.body ?? undefined,
    icon: n.kind ? SEVERITY_ICON[n.kind] : SEVERITY_ICON[n.severity],
    sound,
    href: n.link ?? undefined,
    read: Boolean(n.readAt),
    createdAt: n.createdAt.toISOString(),
  };
}

export interface PersistNotificationInput {
  organizationId: string;
  locationId?: string | null;
  userId?: string | null;
  /** Empleado vinculado al movimiento/evento que origina la notificación (11.7). */
  employeeId?: string | null;
  kind: string;
  title: string;
  body?: string;
  severity?: string;
  link?: string;
  metadata?: Record<string, unknown>;
  /** Si se provee un id de inventario, no duplica alertas activas para ese ítem. */
  dedupeInventoryId?: string;
}

export async function persistNotification(input: PersistNotificationInput) {
  if (input.dedupeInventoryId) {
    const latest = await prisma.notification.findFirst({
      where: {
        organizationId: input.organizationId,
        kind: input.kind,
        readAt: null,
      },
      select: { id: true, metadata: true },
      orderBy: { createdAt: "desc" },
    });
    if (latest) {
      const meta = (latest.metadata as Record<string, unknown> | null) ?? {};
      if (meta.inventoryId === input.dedupeInventoryId) return null;
    }
  }

  const created = await prisma.notification.create({
    data: {
      organizationId: input.organizationId,
      locationId: input.locationId ?? null,
      userId: input.userId ?? null,
      employeeId: input.employeeId ?? null,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      severity: input.severity ?? "info",
      link: input.link ?? null,
      metadata: (input.metadata ?? {}) as object,
    },
  });

  broadcastToOrg(input.organizationId, notificationToPayload(created));
  return created;
}