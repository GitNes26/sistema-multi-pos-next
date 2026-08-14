import { NextRequest, NextResponse } from "next/server";
import { guardCrud, crudErrorResponse } from "../../../guard";
import { customerActivity } from "@/lib/crud/modules/customers";

// FASE 7.3 — Detalle de cliente: historial de puntos, compras, pedidos,
// favoritos y métodos de pago.

export async function GET(req: NextRequest) {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  const id = parts[parts.length - 2];
  const guard = await guardCrud("customers", "view");
  if ("response" in guard) return guard.response;

  try {
    const activity = await customerActivity(guard.organizationId, id);
    return NextResponse.json({ ok: true, activity });
  } catch (err) {
    return crudErrorResponse(err);
  }
}