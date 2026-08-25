import { NextRequest, NextResponse } from "next/server";
import { salesGuard, salesErrorResponse } from "../../../guard";
import { completeReturn } from "@/lib/returns/server";

// POST /api/sales/returns/[returnId]/complete — Procesar devolución
export async function POST(req: NextRequest, { params }: { params: Promise<{ returnId: string }> }) {
  const guard = await salesGuard("sales.view");
  if (guard instanceof NextResponse) return guard;

  try {
    const { returnId } = await params;
    const ret = await completeReturn(guard.organizationId, returnId, guard.userId);
    return NextResponse.json({ ok: true, return: ret });
  } catch (err) {
    return salesErrorResponse(err);
  }
}
