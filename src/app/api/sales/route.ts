import { NextRequest, NextResponse } from "next/server";
import { salesGuard, salesErrorResponse } from "./guard";
import { listSales, type SalesListQuery } from "@/lib/sales/server";

// FASE 9.1 — Historial de ventas (lista con filtros y paginación).

export async function GET(req: NextRequest) {
  const guard = await salesGuard("sales.view");
  if (guard instanceof NextResponse) return guard;

  const sp = req.nextUrl.searchParams;
  const query: SalesListQuery = {
    page: sp.get("page") ? Number(sp.get("page")) : undefined,
    pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : undefined,
    q: sp.get("q") || undefined,
    locationId: sp.get("locationId") || undefined,
    employeeId: sp.get("employeeId") || undefined,
    cashRegisterId: sp.get("cashRegisterId") || undefined,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
    status: sp.get("status") || undefined,
  };

  try {
    const result = await listSales(guard.organizationId, query);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return salesErrorResponse(err);
  }
}