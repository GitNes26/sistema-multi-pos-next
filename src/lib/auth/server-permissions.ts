import { prisma } from "@/lib/db";
import { PERMISSIONS, type PermissionKey } from "@/lib/auth/permission-keys";
import { isFullAccessRole } from "@/lib/auth/permissions";

// FASE 2.8 / 14.5 — Resolución de permisos y guard server-side.

/** Permisos efectivos de un rol (a partir del rol de sistema correspondiente). */
export async function permissionsForRole(role: string): Promise<PermissionKey[]> {
  if (role === "customer") return [];
  // El superAdmin siempre tiene TODO el catálogo (incluye permisos futuros).
  if (role === "superadmin") return PERMISSIONS.map((p) => p.key as PermissionKey);
  const roleId = `system-${role}`;
  const rps = await prisma.rolePermission.findMany({
    where: { roleId, organizationId: null, allowed: true },
    select: { permissionKey: true },
  });
  return rps.map((rp) => rp.permissionKey as PermissionKey);
}

export class PermissionDeniedError extends Error {
  constructor(permission: string) {
    super(`Permiso requerido: ${permission}`);
    this.name = "PermissionDeniedError";
  }
}

/** Lanza si la sesión no tiene el permiso. Para server actions / route handlers. */
export function assertPermission(
  session: { user?: { role?: string; permissions?: string[] } } | null,
  permission: PermissionKey
): void {
  if (!session?.user) throw new PermissionDeniedError(permission);
  const { role, permissions } = session.user;
  if (isFullAccessRole(role)) return;
  if (!permissions?.includes(permission)) throw new PermissionDeniedError(permission);
}
