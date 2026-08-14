import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";

// FASE 11 — Guard del módulo de notificaciones (sesión de admin, no portal).

export type NotificationsGuard = { organizationId: string; userId: string };

export async function notificationsGuard(): Promise<NotificationsGuard | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  if (session.user.scope === "portal" || !session.user.organizationId) {
    return NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 });
  }
  return { organizationId: session.user.organizationId, userId: session.user.id };
}
