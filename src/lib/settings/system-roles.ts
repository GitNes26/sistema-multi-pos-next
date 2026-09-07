import type { $Enums } from "@prisma/client";

// Helpers compartidos de roles de sistema entre el flujo del superAdmin
// (asignación de organizaciones) y el gestor de usuarios de cada organización.

/** Mapea un rol de sistema a su enum OrgRole equivalente (fallback). */
export function roleIdToEnum(roleId: string): $Enums.OrgRole {
  if (roleId.startsWith("system-f")) return "cashier"; // food_service-waiter / -kitchen
  if (roleId.includes("cashier")) return "cashier";
  if (roleId.includes("manager")) return "manager";
  if (roleId.includes("owner")) return "owner";
  if (roleId.includes("admin")) return "admin";
  return "cashier";
}

/** Info mínima de un rol para la compuerta de modo. */
export type RoleModeInfo = {
  isSystem: boolean;
  /** Modo de negocio al que aplica un rol de sistema (null = compartido). */
  businessMode: string | null;
  /** Organización dueña de un rol custom (null = global / rol de sistema). */
  organizationId: string | null;
};

/**
 * Compuerta de modo de negocio (siempre activa, no solo visual):
 * - Rol de sistema: solo se asigna si es compartido (businessMode = null) o su
 *   modo coincide con el de la organización (mesero/cocina/agente no caben en
 *   una org de otro modo).
 * - Rol custom: solo se asigna dentro de su propia organización.
 */
export function roleAllowedInOrg(
  role: RoleModeInfo,
  orgBusinessMode: string,
  membershipOrgId: string
): boolean {
  if (role.isSystem) {
    return role.businessMode === null || role.businessMode === orgBusinessMode;
  }
  return role.organizationId !== null && role.organizationId === membershipOrgId;
}

/** Mensaje consistente de la compuerta para los diálogos de usuarios. */
export const ROLE_MODE_GATE_MESSAGE =
  "Este rol no aplica al modo de negocio de esta organización";
