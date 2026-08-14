import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import type { PermissionKey } from "@/lib/auth/permission-keys";

// FASE 9 — Guard del módulo de ventas.

export type SalesGuard = { organizationId: string; userId: string };

export async function salesGuard(permission: PermissionKey): Promise<SalesGuard | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  if (session.user.scope === "portal" || !session.user.organizationId) {
    return NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 });
  }
  if (!hasPermission(session, permission)) {
    return NextResponse.json({ ok: false, error: "No tienes permiso para esta acción" }, { status: 403 });
  }
  return { organizationId: session.user.organizationId, userId: session.user.id };
}

export function salesErrorResponse(err: unknown): NextResponse {
  if (err && typeof err === "object" && "status" in err && typeof (err as { status: unknown }).status === "number") {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error" },
      { status: (err as { status: number }).status }
    );
  }
  console.error("[sales]", err);
  return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 });
}