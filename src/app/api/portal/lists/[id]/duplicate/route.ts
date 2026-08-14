import { NextResponse } from "next/server";
import { duplicateShoppingList } from "@/lib/portal/server";
import { requirePortalCustomer, portalErrorResponse } from "../../../guard";

// FASE 13.10 — Duplicar una lista de compra.

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  try {
    const list = await duplicateShoppingList(guard.organizationId, guard.customerId, id);
    return NextResponse.json({ ok: true, list });
  } catch (err) {
    return portalErrorResponse(err);
  }
}
