import { NextResponse } from "next/server";
import { getPortalOrder } from "@/lib/portal/server";
import { requirePortalCustomer, portalErrorResponse } from "../../guard";

// FASE 13.7 — Detalle de pedido para el tracking.

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  try {
    const order = await getPortalOrder(guard.organizationId, guard.customerId, id);
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, order });
  } catch (err) {
    return portalErrorResponse(err);
  }
}
