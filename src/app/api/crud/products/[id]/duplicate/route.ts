import { NextRequest, NextResponse } from "next/server";
import { guardCrud, crudErrorResponse } from "../../../guard";
import { duplicateProduct } from "@/lib/crud/modules/products";

// POST /api/crud/products/[id]/duplicate — Duplica un producto (cualquier tipo)
export async function POST(req: NextRequest) {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  const id = parts[parts.length - 2];
  const guard = await guardCrud("products", "manage");
  if ("response" in guard) return guard.response;

  try {
    const row = await duplicateProduct(guard.organizationId, id);
    return NextResponse.json({ ok: true, row }, { status: 201 });
  } catch (err) {
    return crudErrorResponse(err);
  }
}
