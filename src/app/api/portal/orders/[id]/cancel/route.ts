import { NextResponse } from "next/server";
import { cancelPortalOrder } from "@/lib/portal/server";
import { requirePortalCustomer, portalErrorResponse } from "../../../guard";

// FASE 13.8 — Cancelar pedido (solo si no fue confirmado/reclamado).

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  try {
    const order = await cancelPortalOrder(guard.organizationId, guard.customerId, id);
    return NextResponse.json({ ok: true, order });
  } catch (err) {
    return portalErrorResponse(err);
  }
}
