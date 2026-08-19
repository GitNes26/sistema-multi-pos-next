import type { Session } from "next-auth";
import type { $Enums } from "@prisma/client";
import type { PermissionKey } from "@/lib/auth/permission-keys";

// FASE 2.8 — Helpers RBAC seguros para cliente (solo leen la sesión).
// 7.9/7.10 — "admin" es rol propio (permisos de owner) y "superadmin" se
// identifica por rol (scope), no por email.

export type AppRole = $Enums.OrgRole | "customer";
export type SessionRole = AppRole | "superadmin";

export const SYSTEM_ROLE_NAMES = ["superadmin", "admin", "owner", "manager", "cashier"] as const;
export type SystemRoleName = (typeof SYSTEM_ROLE_NAMES)[number];

const PORTAL_ROLES: SessionRole[] = ["customer"];

/** Clave de permiso reservada al superAdmin (menú y página de organizaciones). */
export const SUPERADMIN_ONLY_PERMISSION = "organizations.manage";

/** OrgRole → rol efectivo de la app (admin conserva su rol con permisos de owner). */
export function effectiveRole(role: $Enums.OrgRole): AppRole {
  return role;
}

/** Roles con acceso total (pasan todas las verificaciones). */
export function isFullAccessRole(role: string | null | undefined): boolean {
  return role === "superadmin" || role === "owner" || role === "admin";
}

/** ¿Es el rol que solo ve el superAdmin (organizations.manage)? */
export function isSuperadminOnlyPermission(permission: PermissionKey | string): boolean {
  return permission === SUPERADMIN_ONLY_PERMISSION;
}

/** ¿El usuario tiene el permiso? superadmin/owner/admin pasan siempre. */
export function hasPermission(
  session: Session | null,
  permission: PermissionKey
): boolean {
  if (!session?.user) return false;
  const { role, permissions } = session.user;
  if (isSuperadminOnlyPermission(permission)) return role === "superadmin";
  if (isFullAccessRole(role)) return true;
  return permissions?.includes(permission) ?? false;
}

/** ¿Es sesión de cliente (portal)? */
export function isPortalSession(session: Session | null): boolean {
  return PORTAL_ROLES.includes((session?.user?.role ?? "") as SessionRole);
}
