import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { reportsGuard, reportsErrorResponse } from "../guard";
import {
  getCashReport,
  getCustomersReport,
  getOrdersReport,
  getSalesReport,
  type ReportFilters,
} from "@/lib/reports/server";
import {
  buildCashReportPdf,
  buildCustomersReportPdf,
  buildOrdersReportPdf,
  buildSalesReportPdf,
} from "@/lib/reports/pdf";
import { prisma } from "@/lib/db";

// FASE 10.3 — Exportación de reportes (Excel + PDF profesional).

function parseFilters(sp: URLSearchParams): ReportFilters {
  return {
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
    locationId: sp.get("locationId") || undefined,
    employeeId: sp.get("employeeId") || undefined,
    cashRegisterId: sp.get("cashRegisterId") || undefined,
    status: sp.get("status") || undefined,
  };
}

const MONEY = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

async function orgName(organizationId: string): Promise<string> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
  return org?.name ?? "Reporte";
}

export async function GET(req: NextRequest) {
  const guard = await reportsGuard("reports.export");
  if (guard instanceof NextResponse) return guard;

  const type = req.nextUrl.searchParams.get("type") ?? "sales";
  const format = req.nextUrl.searchParams.get("format") ?? "xlsx";
  const filters = parseFilters(req.nextUrl.searchParams);
  const org = await orgName(guard.organizationId);
  const date = new Date().toISOString().slice(0, 10);

  try {
    if (format === "pdf") {
      let buffer: Buffer;
      let filename: string;

      if (type === "cash") {
        const { rows } = await getCashReport(guard.organizationId, filters);
        console.log(`[reports/pdf] cash: org=${guard.organizationId} rows=${rows.length} sample=${JSON.stringify(rows[0] ?? null)}`);
        buffer = await buildCashReportPdf(org, rows);
        filename = `corte-caja-${date}.pdf`;
      } else if (type === "orders") {
        const { rows } = await getOrdersReport(guard.organizationId, filters);
        console.log(`[reports/pdf] orders: org=${guard.organizationId} rows=${rows.length} sample=${JSON.stringify(rows[0] ?? null)}`);
        buffer = await buildOrdersReportPdf(org, rows);
        filename = `pedidos-${date}.pdf`;
      } else if (type === "customers") {
        const { rows } = await getCustomersReport(guard.organizationId, filters);
        console.log(`[reports/pdf] customers: org=${guard.organizationId} rows=${rows.length} sample=${JSON.stringify(rows[0] ?? null)}`);
        buffer = await buildCustomersReportPdf(org, rows);
        filename = `clientes-${date}.pdf`;
      } else {
        const { rows } = await getSalesReport(guard.organizationId, filters);
        // Consultar total de devoluciones completadas en el mismo período
        const returnsWhere: Record<string, unknown> = { organizationId: guard.organizationId, status: "completed" };
        if (filters.locationId) returnsWhere.locationId = filters.locationId;
        if (filters.from || filters.to) {
          returnsWhere.createdAt = {
            ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00`) } : {}),
            ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999`) } : {}),
          };
        }
        const returnsAgg = await prisma.saleReturn.aggregate({
          where: returnsWhere,
          _sum: { total: true },
        });
        const returnsTotal = Number(returnsAgg._sum.total ?? 0);
        console.log(`[reports/pdf] sales: org=${guard.organizationId} rows=${rows.length} returns=${returnsTotal} sample=${JSON.stringify(rows[0] ?? null)}`);
        buffer = await buildSalesReportPdf(org, rows, returnsTotal);
        filename = `ventas-${date}.pdf`;
      }

      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    // ── Excel ──
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Reporte");
    ws.views = [{ state: "frozen", ySplit: 1 }];

    let filename = `reporte-${date}.xlsx`;

    if (type === "sales") {
      const { rows } = await getSalesReport(guard.organizationId, filters);
      ws.columns = [
        { header: "Folio", width: 10 }, { header: "Fecha", width: 18 }, { header: "Sucursal", width: 22 },
        { header: "Caja", width: 14 }, { header: "Empleado", width: 20 }, { header: "Cliente", width: 22 },
        { header: "Art.", width: 8 }, { header: "Subtotal", width: 12 }, { header: "Descuento", width: 12 },
        { header: "Impuesto", width: 12 }, { header: "Total", width: 12 }, { header: "Puntos", width: 10 },
      ];
      rows.forEach((r) =>
        ws.addRow([
          r.folio, new Date(r.date).toLocaleString("es-MX"), r.locationName, r.registerName ?? "",
          r.employeeName ?? "", r.customerName ?? "", r.itemCount, r.subtotal, r.discount, r.tax, r.total, r.pointsEarned,
        ])
      );
      filename = `ventas-${date}.xlsx`;
    } else if (type === "cash") {
      const { rows } = await getCashReport(guard.organizationId, filters);
      ws.columns = [
        { header: "Caja", width: 14 }, { header: "Sucursal", width: 22 }, { header: "Cajero", width: 20 },
        { header: "Apertura", width: 18 }, { header: "Cierre", width: 18 }, { header: "Estado", width: 10 },
        { header: "Ventas", width: 10 }, { header: "Total ventas", width: 14 }, { header: "Efectivo", width: 12 },
        { header: "Cambio", width: 10 }, { header: "Esperado", width: 12 }, { header: "Corte", width: 12 },
        { header: "Diferencia", width: 12 },
      ];
      rows.forEach((r) =>
        ws.addRow([
          r.registerName ?? "", r.locationName, r.employeeName ?? "",
          r.openedAt ? new Date(r.openedAt).toLocaleString("es-MX") : "", r.closedAt ? new Date(r.closedAt).toLocaleString("es-MX") : "",
          r.status, r.salesCount, r.totalSales, r.cashPayments, r.changeGiven, r.expectedCash,
          r.closingCash ?? "", r.difference ?? "",
        ])
      );
      filename = `corte-caja-${date}.xlsx`;
    } else if (type === "orders") {
      const { rows } = await getOrdersReport(guard.organizationId, filters);
      ws.columns = [
        { header: "Pedido", width: 10 }, { header: "Fecha", width: 18 }, { header: "Cliente", width: 22 },
        { header: "Sucursal", width: 22 }, { header: "Entrega", width: 12 }, { header: "Estado", width: 14 },
        { header: "Art.", width: 8 }, { header: "Total", width: 12 },
      ];
      rows.forEach((r) =>
        ws.addRow([
          r.orderNumber, new Date(r.createdAt).toLocaleString("es-MX"), r.customerName ?? "", r.locationName ?? "",
          r.deliveryMethod, r.status, r.itemsCount, r.total,
        ])
      );
      filename = `pedidos-${date}.xlsx`;
    } else {
      const { rows } = await getCustomersReport(guard.organizationId, filters);
      ws.columns = [
        { header: "Cliente", width: 24 }, { header: "Nº", width: 12 }, { header: "Teléfono", width: 16 },
        { header: "Puntos", width: 10 }, { header: "Compras", width: 10 }, { header: "Total", width: 14 },
        { header: "Última compra", width: 18 },
      ];
      rows.forEach((r) =>
        ws.addRow([
          r.fullName, r.customerCode ?? "", r.phone ?? "", r.points, r.salesCount, r.totalSpent,
          r.lastPurchaseAt ? new Date(r.lastPurchaseAt).toLocaleString("es-MX") : "",
        ])
      );
      filename = `clientes-${date}.xlsx`;
    }

    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F1F5F9" } };

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return reportsErrorResponse(err);
  }
}