import { NextRequest, NextResponse } from "next/server";
import { guardCrud, crudErrorResponse } from "../../../guard";
import { getProductOptions, saveProductOptions } from "@/lib/crud/modules/products";

// FASE 7.1 — Opciones de variante (talla, color, contenido): GET + PUT.

export async function GET(req: NextRequest) {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  const id = parts[parts.length - 2];
  const guard = await guardCrud("products", "view");
  if ("response" in guard) return guard.response;

  try {
    const options = await getProductOptions(guard.organizationId, id);
    return NextResponse.json({ ok: true, rows: options });
  } catch (err) {
    return crudErrorResponse(err);
  }
}

export async function PUT(req: NextRequest) {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  const id = parts[parts.length - 2];
  const guard = await guardCrud("products", "manage");
  if ("response" in guard) return guard.response;

  try {
    const body = (await req.json()) as { options?: { id?: string; name: string; values: { id?: string; value: string }[] }[] };
    const options = await saveProductOptions(guard.organizationId, id, body.options ?? []);
    return NextResponse.json({ ok: true, rows: options });
  } catch (err) {
    return crudErrorResponse(err);
  }
}