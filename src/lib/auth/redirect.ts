import type { SessionRole } from "@/lib/auth/permissions";

// FASE 2.6 — Redirección post-login según rol.

export function homeForRole(role: SessionRole | undefined): string {
  switch (role) {
    case "customer":
      return "/portal";
    case "cashier":
      return "/pos";
    case "superadmin":
    case "owner":
    case "manager":
      return "/admin";
    default:
      return "/auth/login";
  }
}

/** Resuelve el destino final respetando un callbackUrl explícito cuando es seguro. */
export function resolveLoginDestination(
  role: SessionRole | undefined,
  callbackUrl?: string | null
): string {
  if (callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
    return callbackUrl;
  }
  return homeForRole(role);
}