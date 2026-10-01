import { NextRequest, NextResponse } from "next/server";
import { salesGuard, salesErrorResponse } from "../../guard";
import { searchExchangeOptions } from "@/lib/returns/server";

// GET /api/sales/[id]/exchange-options?q= — Productos con existencia para un cambio
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await salesGuard("sales.view");
  if (guard instanceof NextResponse) return guard;

  try {
    const { id } = await params;
    const options = await searchExchangeOptions(guard.organizationId, id, req.nextUrl.searchParams.get("q") ?? "");
    return NextResponse.json({ ok: true, options });
  } catch (err) {
    return salesErrorResponse(err);
  }
}
