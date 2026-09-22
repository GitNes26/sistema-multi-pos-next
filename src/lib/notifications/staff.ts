import { prisma } from "@/lib/db";
import { persistNotification } from "@/lib/notifications/helpers";

type StaffPermission = "purchasing.manage" | "purchasing.approve" | "purchasing.receive" | "orders.view";

/** Entrega una alerta solo a usuarios activos con el permiso operativo indicado. */
export async function notifyStaff(organizationId: string, permission: StaffPermission, event: {
  kind: string; title: string; body: string; link: string; severity?: string; excludeUserId?: string;
}) {
  const memberships = await prisma.membership.findMany({
    where: { organizationId, user: { isActive: true } },
    select: { userId: true, role: true, user: { select: { isSuperadmin: true } }, roleRef: { select: { permissions: { select: { permissionKey: true, allowed: true } } } } },
  });
  const recipients = memberships.filter((membership) =>
    membership.userId !== event.excludeUserId && (
      membership.user.isSuperadmin || ["owner", "admin", "superadmin"].includes(membership.role) ||
      membership.roleRef?.permissions.some((entry) => entry.permissionKey === permission && entry.allowed)
    )
  );
  await Promise.all(recipients.map((recipient) => persistNotification({
    organizationId, recipientUserId: recipient.userId, kind: event.kind,
    title: event.title, body: event.body, link: event.link, severity: event.severity ?? "info",
    metadata: { permission },
  })));
}
