import { NextResponse } from "next/server";
import { removeFavorite } from "@/lib/portal/server";
import { requirePortalCustomer, portalErrorResponse } from "../../guard";

// FASE 13.9 — Quitar favorito.

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ variantId: string }> }
) {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  const { variantId } = await params;
  try {
    const result = await removeFavorite(guard.organizationId, guard.customerId, variantId);
    return NextResponse.json(result);
  } catch (err) {
    return portalErrorResponse(err);
  }
}
