import { NextResponse } from "next/server";
import { addPaymentMethod, listPaymentMethods } from "@/lib/portal/server";
import { requirePortalCustomer, portalErrorResponse } from "../guard";

// FASE 13.14 — Métodos de pago guardados (GET listado, POST agregar).

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  try {
    const methods = await listPaymentMethods(guard.organizationId, guard.customerId);
    return NextResponse.json({ ok: true, methods });
  } catch (err) {
    return portalErrorResponse(err);
  }
}

export async function POST(req: Request) {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  try {
    const input = await req.json();
    const methods = await addPaymentMethod(guard.organizationId, guard.customerId, input);
    return NextResponse.json({ ok: true, methods });
  } catch (err) {
    return portalErrorResponse(err);
  }
}
