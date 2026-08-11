import type { Session } from "next-auth";
import type { $Enums } from "@prisma/client";
import type { PermissionKey } from "@/lib/auth/permission-keys";

// FASE 2.8 — Helpers RBAC seguros para cliente (solo leen la sesión).

export type AppRole = Exclude<$Enums.OrgRole, "admin"> | "customer";
export type SessionRole = AppRole | "superadmin";

export const SYSTEM_ROLE_NAMES = ["superadmin", "owner", "manager", "cashier"] as const;
export type SystemRoleName = (typeof SYSTEM_ROLE_NAMES)[number];

const PORTAL_ROLES: SessionRole[] = ["customer"];

/** OrgRole → rol efectivo de la app (admin se trata como manager). */
export function effectiveRole(role: $Enums.OrgRole): AppRole {
  if (role === "admin") return "manager";
  return role;
}

/** ¿El usuario tiene el permiso? superadmin/owner pasan siempre. */
export function hasPermission(
  session: Session | null,
  permission: PermissionKey
): boolean {
  if (!session?.user) return false;
  const { role, permissions } = session.user;
  if (role === "superadmin" || role === "owner") return true;
  return permissions?.includes(permission) ?? false;
}

/** ¿Es sesión de cliente (portal)? */
export function isPortalSession(session: Session | null): boolean {
  return PORTAL_ROLES.includes((session?.user?.role ?? "") as SessionRole);
}