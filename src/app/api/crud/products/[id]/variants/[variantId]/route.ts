import { NextRequest, NextResponse } from "next/server";
import { guardCrud, crudErrorResponse } from "../../../../guard";
import { updateVariant, deleteVariant } from "@/lib/crud/modules/products";

export async function PATCH(req: NextRequest) {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  const id = parts[parts.length - 3]; // productId
  const variantId = parts[parts.length - 1]; // variantId
  void id;
  const guard = await guardCrud("products", "manage");
  if ("response" in guard) return guard.response;

  try {
    const body = await req.json();
    const variant = await updateVariant(guard.organizationId, variantId, body);
    return NextResponse.json({ ok: true, row: variant });
  } catch (err) {
    return crudErrorResponse(err);
  }
}

export async function DELETE(req: NextRequest) {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  const variantId = parts[parts.length - 1];
  const guard = await guardCrud("products", "delete");
  if ("response" in guard) return guard.response;

  try {
    await deleteVariant(guard.organizationId, variantId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return crudErrorResponse(err);
  }
}