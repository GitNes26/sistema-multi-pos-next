import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolvePublicOrg } from "@/lib/tables/public-org";

export const dynamic = "force-dynamic";

// GET /api/public/locations?org= — Sucursales activas de la organización para
// el wizard de reservación de invitado (/reservar). Igual resolución pública
// que el menú digital (?org= o ?table=&token=).

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const org = await resolvePublicOrg(url);
    if ("error" in org) {
      return NextResponse.json({ ok: false, error: org.error }, { status: org.status });
    }
    const locations = await prisma.location.findMany({
      where: { organizationId: org.organizationId, isActive: true },
      select: { id: true, name: true, address: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ ok: true, locations });
  } catch (err) {
    console.error("[public/locations] GET Error:", err);
    return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 });
  }
}
