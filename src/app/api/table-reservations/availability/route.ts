import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { computeAvailability } from "@/lib/tables/availability";

export const dynamic = "force-dynamic";

// GET /api/table-reservations/availability?date=&time=&locationId=&guests=
// Disponibilidad para el wizard de reservación (panel y portal):
// - sin `date`: días seleccionables del calendario + política vigente.
// - con `date`: slots del día con cupo por sala.
// - con `date` + `time`: mesas del slot (libre/ocupada) para el plano.

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const organizationId = effectiveOrgId(session);
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Sin organización" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date");
    const time = url.searchParams.get("time");
    const locationId = url.searchParams.get("locationId") || null;
    const guests = Math.max(1, Math.round(Number(url.searchParams.get("guests")) || 0) || 2);

    const result = await computeAvailability(organizationId, locationId, date, time, guests);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("[table-reservations/availability] GET Error:", error);
    return NextResponse.json({ ok: false, error: "Error al calcular disponibilidad" }, { status: 500 });
  }
}
