import { NextRequest, NextResponse } from "next/server";
import { salesGuard, salesErrorResponse } from "../guard";
import { exportSalesPdf, exportSalesXlsx, type SalesListQuery } from "@/lib/sales/server";
import { prisma } from "@/lib/db";

// FASE 9.6 — Exportación de ventas (Excel + PDF).

function parseQuery(sp: URLSearchParams): SalesListQuery {
  return {
    q: sp.get("q") || undefined,
    locationId: sp.get("locationId") || undefined,
    employeeId: sp.get("employeeId") || undefined,
    cashRegisterId: sp.get("cashRegisterId") || undefined,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
    status: sp.get("status") || undefined,
  };
}

export async function GET(req: NextRequest) {
  const guard = await salesGuard("sales.view");
  if (guard instanceof NextResponse) return guard;

  const format = req.nextUrl.searchParams.get("format") ?? "xlsx";

  try {
    if (format === "pdf") {
      const org = await prisma.organization.findUnique({
        where: { id: guard.organizationId },
        select: { name: true },
      });
      const { buffer, filename } = await exportSalesPdf(
        guard.organizationId,
        org?.name ?? "Reporte",
        parseQuery(req.nextUrl.searchParams)
      );
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const { buffer, filename } = await exportSalesXlsx(
      guard.organizationId,
      parseQuery(req.nextUrl.searchParams)
    );
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return salesErrorResponse(err);
  }
}