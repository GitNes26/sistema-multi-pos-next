import { NextResponse } from "next/server";
import { getPortalHome } from "@/lib/portal/server";
import { requirePortalCustomer, portalErrorResponse } from "../guard";

// FASE 13.2 — Home del portal: puntos, promos, pedidos activos, novedades y avisos.

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  try {
    const home = await getPortalHome(guard.organizationId, guard.customerId);
    return NextResponse.json({ ok: true, ...home });
  } catch (err) {
    return portalErrorResponse(err);
  }
}
