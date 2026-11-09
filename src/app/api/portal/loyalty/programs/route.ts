import { NextResponse } from "next/server";
import { getCustomerLoyalty } from "@/lib/loyalty/server";
import { requirePortalCustomer, portalErrorResponse } from "../../guard";

export const dynamic = "force-dynamic";

// Mis programas de fidelidad del negocio: créditos disponibles y avance de la tarjeta de visitas.
export async function GET() {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;
  try {
    const programs = await getCustomerLoyalty(guard.organizationId, guard.customerId);
    return NextResponse.json({ ok: true, programs: programs.map((p) => ({ programId: p.programId, name: p.name, kind: p.kind, credits: p.credits, visits: p.visits, visitsRequired: p.visitsRequired, membership: p.membership })) });
  } catch (err) {
    return portalErrorResponse(err);
  }
}
