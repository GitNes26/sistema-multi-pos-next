import { NextRequest, NextResponse } from "next/server";
import { salesGuard, salesErrorResponse } from "../guard";
import { listReturns } from "@/lib/returns/server";
import { jsonResponse } from "@/lib/api-helpers";

// GET /api/sales/returns — Listado global de devoluciones
export async function GET(req: NextRequest) {
  const guard = await salesGuard("sales.view");
  if (guard instanceof NextResponse) return guard;

  try {
    const sp = req.nextUrl.searchParams;
    const result = await listReturns(guard.organizationId, {
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
      status: sp.get("status") ?? undefined,
      returnType: sp.get("returnType") ?? undefined,
      locationId: sp.get("locationId") ?? undefined,
      page: sp.has("page") ? Number(sp.get("page")) : undefined,
      pageSize: sp.has("pageSize") ? Number(sp.get("pageSize")) : undefined,
    });
    return jsonResponse({ ok: true, ...result });
  } catch (err) {
    return salesErrorResponse(err);
  }
}
