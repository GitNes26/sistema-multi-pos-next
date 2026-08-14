import { NextResponse } from "next/server";
import { listExpiringCards } from "@/lib/portal/server";
import { requirePortalCustomer, portalErrorResponse } from "../guard";

// FASE 13.15 — Tarjetas por vencer (próximos 2 meses).

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  try {
    const cards = await listExpiringCards(guard.organizationId, guard.customerId);
    return NextResponse.json({ ok: true, cards });
  } catch (err) {
    return portalErrorResponse(err);
  }
}
