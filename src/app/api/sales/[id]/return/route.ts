import { NextRequest, NextResponse } from "next/server";
import { salesGuard, salesErrorResponse } from "../../guard";
import { createReturn } from "@/lib/returns/server";

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
      reason: body.reason,
      notes: body.notes,
      items: body.items,
      exchangeVariantId: body.exchangeVariantId,
    });
    return NextResponse.json({ ok: true, return: ret });
  } catch (err) {
    return salesErrorResponse(err);
  }
}
