import { NextResponse } from "next/server";
import { getPortalOrder } from "@/lib/portal/server";
import { createOrderCheckout } from "@/lib/payments/server";
import { requirePortalCustomer, portalErrorResponse } from "../../../guard";

// FASE 16 — Crear la sesión de pago de un pedido del portal.

export const dynamic = "force-dynamic";

export async function POST(
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
    const { url } = await createOrderCheckout(id);
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    return portalErrorResponse(err);
  }
}
