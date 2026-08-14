import { NextResponse } from "next/server";
import { listPortalLocations } from "@/lib/portal/server";
import { requirePortalCustomer, portalErrorResponse } from "../guard";

// FASE 13.6 — Sucursales disponibles para pickup/delivery.

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  try {
    const locations = await listPortalLocations(guard.organizationId);
    return NextResponse.json({ ok: true, locations });
  } catch (err) {
    return portalErrorResponse(err);
  }
}
