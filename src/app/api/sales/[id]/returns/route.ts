import { NextRequest, NextResponse } from "next/server";
import { salesGuard, salesErrorResponse } from "../../guard";
import { getSaleReturns } from "@/lib/returns/server";

// GET /api/sales/[id]/returns — Devoluciones de una venta
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await salesGuard("sales.view");
  if (guard instanceof NextResponse) return guard;

  try {
    const { id } = await params;
    const returns = await getSaleReturns(guard.organizationId, id);
    return NextResponse.json({ ok: true, returns });
  } catch (err) {
    return salesErrorResponse(err);
  }
}
