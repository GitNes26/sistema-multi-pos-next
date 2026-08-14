import { NextResponse } from "next/server";
import {
  deleteShoppingList,
  getShoppingList,
  updateShoppingList,
} from "@/lib/portal/server";
import { requirePortalCustomer, portalErrorResponse } from "../../guard";

// FASE 13.10 — Detalle (GET), edición (PATCH) y borrado (DELETE) de una lista.

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  try {
    const list = await getShoppingList(guard.organizationId, guard.customerId, id);
    if (!list) return NextResponse.json({ ok: false, error: "Lista no encontrada" }, { status: 404 });
    return NextResponse.json({ ok: true, list });
  } catch (err) {
    return portalErrorResponse(err);
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  try {
    const input = await req.json();
    const list = await updateShoppingList(guard.organizationId, guard.customerId, id, input);
    return NextResponse.json({ ok: true, list });
  } catch (err) {
    return portalErrorResponse(err);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  const { id } = await params;
  try {
    const result = await deleteShoppingList(guard.organizationId, guard.customerId, id);
    return NextResponse.json(result);
  } catch (err) {
    return portalErrorResponse(err);
  }
}
