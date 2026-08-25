import { NextRequest, NextResponse } from "next/server";
import { salesGuard, salesErrorResponse } from "../../guard";
import { getReturnDetail } from "@/lib/returns/server";

// GET /api/sales/returns/[returnId] — Detalle de devolución
export async function GET(req: NextRequest, { params }: { params: Promise<{ returnId: string }> }) {
  const guard = await salesGuard("sales.view");
  if (guard instanceof NextResponse) return guard;

  try {
    const { returnId } = await params;
    const ret = await getReturnDetail(guard.organizationId, returnId);
    return NextResponse.json({ ok: true, return: ret });
  } catch (err) {
    return salesErrorResponse(err);
  }
}
