import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { effectiveOrgId } from "@/lib/auth/org-context";
import type { PermissionKey } from "@/lib/auth/permission-keys";

// FASE 8 — Guard del módulo de inventario.

export type InventoryGuard = { organizationId: string; userId: string };

export async function inventoryGuard(permission: PermissionKey): Promise<InventoryGuard | NextResponse> {
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

export function inventoryErrorResponse(err: unknown): NextResponse {
  if (err && typeof err === "object" && "status" in err && typeof (err as { status: unknown }).status === "number") {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error" },
      { status: (err as { status: number }).status }
    );
  }
  console.error("[inventory]", err);
  return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 });
}