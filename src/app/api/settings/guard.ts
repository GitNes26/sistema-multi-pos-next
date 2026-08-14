import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import type { Session } from "next-auth";

// FASE 15 — Guard de rutas de ajustes.

type GuardResult = { session: Session; organizationId: string } | { response: NextResponse };

/** Sesión de app (no portal) con organización. */
export async function settingsSession(): Promise<GuardResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { response: NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 }) };
  }
  if (session.user.scope === "portal" || !session.user.organizationId) {
    return { response: NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 }) };
  }
  return { session, organizationId: session.user.organizationId };
}

/** Requiere `settings.manage` (empresa, lealtad, supervisor, apariencia). */
export async function settingsManageGuard(): Promise<GuardResult> {
  const g = await settingsSession();
  if ("response" in g) return g;
  if (!hasPermission(g.session, "settings.manage")) {
    return { response: NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 }) };
  }
  return g;
}

/** Requiere `users.manage` (usuarios, roles, invitaciones). */
export async function usersManageGuard(): Promise<GuardResult> {
  const g = await settingsSession();
  if ("response" in g) return g;
  if (!hasPermission(g.session, "users.manage")) {
    return { response: NextResponse.json({ ok: false, error: "Sin permisos" }, { status: 403 }) };
  }
  return g;
}

export function settingsErrorResponse(err: unknown): NextResponse {
  console.error("[settings]", err);
  return NextResponse.json(
    { ok: false, error: err instanceof Error ? err.message : "Error del servidor" },
    { status: 500 }
  );
}
