import { NextResponse } from "next/server";
import { removePaymentMethod } from "@/lib/portal/server";
import { requirePortalCustomer, portalErrorResponse } from "../../guard";

// FASE 13.14 — Quitar método de pago.

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  try {
    const result = await removePaymentMethod(guard.organizationId, guard.customerId, id);
    return NextResponse.json(result);
  } catch (err) {
    return portalErrorResponse(err);
  }
}
