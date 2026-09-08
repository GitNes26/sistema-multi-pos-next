import { NextResponse } from "next/server";
import { resolvePublicOrg } from "@/lib/tables/public-org";
import { computeAvailability } from "@/lib/tables/availability";

export const dynamic = "force-dynamic";

// GET /api/public/reservations/availability?org=&date=&time=&locationId=&guests=
// Disponibilidad para el wizard de reservación de invitado (/reservar):
// mismo cálculo que el panel/portal, pero resolvendo la organización de forma
// pública (?org= o ?table=&token=).

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const org = await resolvePublicOrg(url);
    if ("error" in org) {
      return NextResponse.json({ ok: false, error: org.error }, { status: org.status });
    }
    const date = url.searchParams.get("date");
    const time = url.searchParams.get("time");
    const locationId = url.searchParams.get("locationId") || org.locationId;
    const guests = Math.max(1, Math.round(Number(url.searchParams.get("guests")) || 0) || 2);

    const result = await computeAvailability(org.organizationId, locationId, date, time, guests);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error("[public/reservations/availability] GET Error:", err);
    return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 });
  }
}
