import { NextRequest, NextResponse } from "next/server";
import { salesGuard, salesErrorResponse } from "../../../guard";
import { rejectReturn } from "@/lib/returns/server";

// PUT /api/sales/returns/[returnId]/reject — Rechazar devolución
export async function PUT(req: NextRequest, { params }: { params: Promise<{ returnId: string }> }) {
  const guard = await salesGuard("sales.manage");
  if (guard instanceof NextResponse) return guard;

  try {
    const { returnId } = await params;
    const ret = await rejectReturn(guard.organizationId, returnId);
    return NextResponse.json({ ok: true, return: ret });
  } catch (err) {
    return salesErrorResponse(err);
  }
}
