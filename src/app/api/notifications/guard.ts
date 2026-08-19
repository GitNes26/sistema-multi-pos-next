import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";

// FASE 11 — Guard del módulo de notificaciones (sesión de admin, no portal).

export type NotificationsGuard = { organizationId: string; userId: string };

export async function notificationsGuard(): Promise<NotificationsGuard | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const organizationId = effectiveOrgId(session);
  if (session.user.scope === "portal" || !organizationId) {
    return NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 });
  }
  return { organizationId, userId: session.user.id };
}
