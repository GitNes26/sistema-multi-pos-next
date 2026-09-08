import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { hasPermission } from "@/lib/auth/permissions";
import { getReservationPolicy, upsertReservationPolicy } from "@/lib/tables/reservations-policy";

export const dynamic = "force-dynamic";

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

// GET /api/table-reservations/policy — política vigente de la organización.
export async function GET() {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  try {
    const policy = await getReservationPolicy(guard.organizationId);
    return NextResponse.json({ ok: true, policy });
  } catch (error) {
    console.error("[table-reservations/policy] GET Error:", error);
    return NextResponse.json({ ok: false, error: "Error al obtener la política" }, { status: 500 });
  }
}

// PATCH /api/table-reservations/policy — guardar la política (locations.manage).
export async function PATCH(req: Request) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  if (!hasPermission(guard.session, "locations.manage")) {
    return NextResponse.json({ ok: false, error: "Permiso requerido: locations.manage" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const policy = await upsertReservationPolicy(guard.organizationId, body);
    return NextResponse.json({ ok: true, policy });
  } catch (error) {
    console.error("[table-reservations/policy] PATCH Error:", error);
    return NextResponse.json({ ok: false, error: "Error al guardar la política" }, { status: 500 });
  }
}
