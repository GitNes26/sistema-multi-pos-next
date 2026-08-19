import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { effectiveOrgId } from "@/lib/auth/org-context";
import type { PermissionKey } from "@/lib/auth/permission-keys";

// FASE 12 — Guard del módulo de pedidos.

export type OrdersGuard = { organizationId: string; userId: string };

export async function ordersGuard(permission: PermissionKey): Promise<OrdersGuard | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const organizationId = effectiveOrgId(session);
  if (session.user.scope === "portal" || !organizationId) {
    return NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 });
  }
  if (!hasPermission(session, permission)) {
    return NextResponse.json({ ok: false, error: "No tienes permiso para esta acción" }, { status: 403 });
  }
  return { organizationId, userId: session.user.id };
}

export function ordersErrorResponse(err: unknown): NextResponse {
  const status =
    err && typeof err === "object" && "status" in err && typeof (err as { status: unknown }).status === "number"
      ? (err as { status: number }).status
      : 500;
  console.error("[orders]", err);
  return NextResponse.json(
    { ok: false, error: err instanceof Error ? err.message : "Error del servidor" },
    { status }
  );
}
