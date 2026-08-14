import { NextResponse } from "next/server";
import { salesGuard, salesErrorResponse } from "../guard";
import { getSaleDetail } from "@/lib/sales/server";

// FASE 9.2 — Detalle completo de una venta (ticket/reimpresión).

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await salesGuard("sales.view");
  if (guard instanceof NextResponse) return guard;
  const { id } = await context.params;

  try {
    const sale = await getSaleDetail(guard.organizationId, id);
    return NextResponse.json({ ok: true, sale });
  } catch (err) {
    return salesErrorResponse(err);
  }
}