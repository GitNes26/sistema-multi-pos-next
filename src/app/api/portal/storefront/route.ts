import { NextResponse } from "next/server";
import { getStorefront } from "@/lib/portal/server";
import { requirePortalCustomer, portalErrorResponse } from "../guard";

// FASE 13.3/13.4 — Catálogo del portal (categorías + productos con variantes/granel).

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  try {
    const data = await getStorefront(guard.organizationId, guard.customerId);
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    return portalErrorResponse(err);
  }
}
