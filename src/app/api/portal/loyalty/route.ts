import { NextResponse } from "next/server";
import { getLoyalty } from "@/lib/portal/server";
import { requirePortalCustomer, portalErrorResponse } from "../guard";

// FASE 13.12 — Puntos acumulados + historial de lealtad.

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  try {
    const data = await getLoyalty(guard.organizationId, guard.customerId);
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    return portalErrorResponse(err);
  }
}
