import { NextResponse } from "next/server";
import { setDefaultPaymentMethod } from "@/lib/portal/server";
import { requirePortalCustomer, portalErrorResponse } from "../../../guard";

// FASE 13.14 — Marcar método de pago como predeterminado.

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  try {
    const methods = await setDefaultPaymentMethod(guard.organizationId, guard.customerId, id);
    return NextResponse.json({ ok: true, methods });
  } catch (err) {
    return portalErrorResponse(err);
  }
}
