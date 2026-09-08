import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import {
  getUpcomingWindowMs,
  invalidateUpcomingWindowCache,
  MAX_UPCOMING_WINDOW_HOURS,
} from "@/lib/tables/upcoming";

export const dynamic = "force-dynamic";

const DENIED = { ok: false, error: "Permiso requerido: locations.manage" };

/** Sesión de app con organización (base común de todos los handlers). */
async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { response: NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 }) };
  }
  const organizationId = effectiveOrgId(session);
  if (!organizationId) {
    return { response: NextResponse.json({ ok: false, error: "Sin organización" }, { status: 403 }) };
  }
  return { session, organizationId };
}

// GET /api/table-reservations/settings — horas de anticipación del aviso de
// llegada de reservaciones (ventana de "próximas reservas" en POS/KDS).
export async function GET() {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  if (!hasPermission(guard.session, "locations.manage")) {
    return NextResponse.json(DENIED, { status: 403 });
  }

  try {
    const ms = await getUpcomingWindowMs(guard.organizationId);
    return NextResponse.json({
      ok: true,
      upcomingWindowHours: Math.round(ms / (60 * 60 * 1000)),
    });
  } catch (error) {
    console.error("[table-reservations/settings] GET Error:", error);
    return NextResponse.json({ ok: false, error: "Error al obtener la configuración" }, { status: 500 });
  }
}

// PATCH /api/table-reservations/settings — actualizar las horas de anticipación.
export async function PATCH(req: Request) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;
  const { organizationId } = guard;

  if (!hasPermission(guard.session, "locations.manage")) {
    return NextResponse.json(DENIED, { status: 403 });
  }

  try {
    const body = await req.json();
    const hours = Math.round(Number(body?.upcomingWindowHours));
    if (!hours || hours < 1 || hours > MAX_UPCOMING_WINDOW_HOURS) {
      return NextResponse.json(
        { ok: false, error: `Horas inválidas (1–${MAX_UPCOMING_WINDOW_HOURS})` },
        { status: 400 }
      );
    }

    await prisma.organization.update({
      where: { id: organizationId },
      data: { upcomingWindowHours: hours },
    });
    invalidateUpcomingWindowCache(organizationId);

    return NextResponse.json({ ok: true, upcomingWindowHours: hours });
  } catch (error) {
    console.error("[table-reservations/settings] PATCH Error:", error);
    return NextResponse.json({ ok: false, error: "Error al guardar la configuración" }, { status: 500 });
  }
}
