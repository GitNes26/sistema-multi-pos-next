import { prisma } from "@/lib/db";
import type { PermissionKey } from "@/lib/auth/permission-keys";

// FASE 2.8 / 14.5 — Resolución de permisos y guard server-side.

/** Permisos efectivos de un rol (a partir del rol de sistema correspondiente). */
export async function permissionsForRole(role: string): Promise<PermissionKey[]> {
  if (role === "customer") return [];
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
  if (role === "superadmin" || role === "owner") return;
  if (!permissions?.includes(permission)) throw new PermissionDeniedError(permission);
}