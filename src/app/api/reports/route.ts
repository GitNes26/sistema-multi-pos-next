import { NextRequest, NextResponse } from "next/server";
import { reportsGuard, reportsErrorResponse } from "./guard";
import {
  getCashReport,
  getCreditReport,
  getCustomersReport,
  getDashboardData,
  getOrdersReport,
  getSalesReport,
  type ReportFilters,
} from "@/lib/reports/server";

// FASE 10.2/10.4 — Reportes con filtros avanzados (tipo + fecha/sucursal/empleado/caja).

function parseFilters(sp: URLSearchParams): ReportFilters {
  return {
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
    locationId: sp.get("locationId") || undefined,
    employeeId: sp.get("employeeId") || undefined,
    cashRegisterId: sp.get("cashRegisterId") || undefined,
    status: sp.get("status") || undefined,
    limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
  };
}

export async function GET(req: NextRequest) {
  const guard = await reportsGuard("reports.view");
  if (guard instanceof NextResponse) return guard;

  const type = req.nextUrl.searchParams.get("type") ?? "sales";
  const filters = parseFilters(req.nextUrl.searchParams);

  try {
    switch (type) {
      case "dashboard":
        return NextResponse.json({ ok: true, data: await getDashboardData(guard.organizationId) });
      case "cash":
        return NextResponse.json({ ok: true, ...(await getCashReport(guard.organizationId, filters)) });
      case "orders":
        return NextResponse.json({ ok: true, ...(await getOrdersReport(guard.organizationId, filters)) });
      case "customers":
        return NextResponse.json({ ok: true, ...(await getCustomersReport(guard.organizationId, filters)) });
      case "credit":
        return NextResponse.json({ ok: true, ...(await getCreditReport(guard.organizationId, filters)) });
      case "sales":
      default:
        return NextResponse.json({ ok: true, ...(await getSalesReport(guard.organizationId, filters)) });
    }
  } catch (err) {
    return reportsErrorResponse(err);
  }
}