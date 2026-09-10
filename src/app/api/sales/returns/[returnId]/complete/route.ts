import { NextRequest, NextResponse } from "next/server";
import { salesGuard, salesErrorResponse } from "../../../guard";
import { completeReturn } from "@/lib/returns/server";
import { jsonResponse } from "@/lib/api-helpers";

// POST /api/sales/returns/[returnId]/complete — Procesar devolución
export async function POST(req: NextRequest, { params }: { params: Promise<{ returnId: string }> }) {
  const guard = await salesGuard("sales.manage");
  if (guard instanceof NextResponse) return guard;

  try {
    const { returnId } = await params;
    const ret = await completeReturn(guard.organizationId, returnId, guard.userId);
    return jsonResponse({ ok: true, return: ret });
  } catch (err) {
    return salesErrorResponse(err);
  }
}
