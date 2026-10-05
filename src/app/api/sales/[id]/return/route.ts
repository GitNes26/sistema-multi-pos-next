import { jsonResponse } from "@/lib/api-helpers";
import { NextRequest, NextResponse } from "next/server";
import { salesGuard, salesErrorResponse } from "../../guard";
import { createReturn, getSaleReturnContext } from "@/lib/returns/server";

// GET /api/sales/[id]/return — contexto de bonificación (cliente y opciones habilitadas)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await salesGuard("sales.view");
  if (guard instanceof NextResponse) return guard;
  try {
    const { id } = await params;
    const customerId = req.nextUrl.searchParams.get("customerId");
    return jsonResponse({ ok: true, context: await getSaleReturnContext(guard.organizationId, id, customerId) });
  } catch (err) {
    return salesErrorResponse(err);
  }
}

// POST /api/sales/[id]/return — Crear devolución
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await salesGuard("sales.view");
  if (guard instanceof NextResponse) return guard;

  try {
    const { id } = await params;
    const body = await req.json();
    const ret = await createReturn(guard.organizationId, guard.userId, {
      saleId: id,
      returnType: body.returnType,
      customerId: typeof body.customerId === "string" ? body.customerId : null,
      reason: body.reason,
      notes: body.notes,
      items: body.items,
      exchangeItems: body.exchangeItems,
    });
    return jsonResponse({ ok: true, return: ret });
  } catch (err) {
    return salesErrorResponse(err);
  }
}
