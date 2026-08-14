import { NextResponse } from "next/server";
import { createPortalOrder, listPortalOrders } from "@/lib/portal/server";
import { requirePortalCustomer, portalErrorResponse } from "../guard";

// FASE 13.6/13.11 — Crear pedido (POST) y listar historial (GET).

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  try {
    const orders = await listPortalOrders(guard.organizationId, guard.customerId);
    return NextResponse.json({ ok: true, orders });
  } catch (err) {
    return portalErrorResponse(err);
  }
}

export async function POST(req: Request) {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  try {
    const input = await req.json();
    const order = await createPortalOrder(guard.organizationId, guard.customerId, input);
    return NextResponse.json({ ok: true, order });
  } catch (err) {
    return portalErrorResponse(err);
  }
}
