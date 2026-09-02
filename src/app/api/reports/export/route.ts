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
  getOmnichannelReport,
  getProductRanking,
  getInventoryValuation,
  getEmployeeRanking,
  getLoyaltySummary,
  getCreditAging,
  getPromotionsRoi,
  getDeliveryPerformance,
  getLowStockAlerts,
  getCustomerSegmentation,
  getMarginAnalysis,
  getProductPairs,
  getTransferEfficiency,
  getInventoryFillRate,
  getEmployeeMargin,
  getSalesForecast,
  getDailyTrend,
  getPaymentMix,
} from "@/lib/reports/bi-server";
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
    // ── BI Reports ──
    const biTypes = ["omnichannel", "ranking", "inventory", "employee_ranking", "loyalty", "credit_aging", "promos_roi", "delivery", "low_stock", "segmentation", "margin", "daily_trend", "payment_mix", "product_pairs", "transfers", "fill_rate", "employee_margin", "forecast"];
    if (biTypes.includes(type)) {
      const biFilters = { from: filters.from, to: filters.to, locationId: filters.locationId };

      if (format === "xlsx") {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Reporte BI");
        ws.views = [{ state: "frozen", ySplit: 1 }];

        if (type === "omnichannel") {
          const data = await getOmnichannelReport(guard.organizationId, biFilters);
          ws.columns = [
            { header: "Sucursal", width: 22 }, { header: "POS", width: 14 }, { header: "Portal", width: 14 },
            { header: "Total", width: 14 }, { header: "% Web", width: 10 }, { header: "AOV POS", width: 12 }, { header: "AOV Portal", width: 12 },
          ];
          data.rows.forEach((r) => ws.addRow([r.locationName, r.posSales, r.portalSales, r.total, r.pctWeb, r.aovPos, r.aovPortal]));
        } else if (type === "ranking") {
          const sort = (req.nextUrl.searchParams.get("sort") ?? "revenue") as "quantity" | "revenue" | "margin";
          const data = await getProductRanking(guard.organizationId, biFilters, sort);
          ws.columns = [
            { header: "#", width: 5 }, { header: "Producto", width: 30 }, { header: "Categoría", width: 20 },
            { header: "Unidades", width: 10 }, { header: "Ingreso", width: 14 }, { header: "Margen", width: 14 }, { header: "Margen %", width: 10 },
          ];
          data.rows.forEach((r, i) => ws.addRow([i + 1, r.productName, r.categoryName, r.quantity, r.revenue, r.margin, r.marginPct]));
        } else if (type === "inventory") {
          const data = await getInventoryValuation(guard.organizationId, biFilters);
          ws.columns = [
            { header: "Categoría", width: 22 }, { header: "Valor Costo", width: 14 }, { header: "Valor Venta", width: 14 },
            { header: "Productos", width: 10 }, { header: "Sin Stock", width: 10 },
          ];
          data.rows.forEach((r) => ws.addRow([r.categoryName, r.valueAtCost, r.valueAtRetail, r.productCount, r.outOfStock]));
        } else if (type === "employee_ranking") {
          const data = await getEmployeeRanking(guard.organizationId, biFilters);
          ws.columns = [
            { header: "Empleado", width: 25 }, { header: "Ventas", width: 14 }, { header: "Ticket Prom.", width: 12 },
            { header: "N° Pedidos", width: 10 }, { header: "Unidades", width: 10 },
          ];
          data.rows.forEach((r) => ws.addRow([r.employeeName, r.totalSales, r.avgTicket, r.saleCount, r.totalUnits]));
        } else if (type === "loyalty") {
          const data = await getLoyaltySummary(guard.organizationId, biFilters);
          ws.columns = [
            { header: "Cliente", width: 25 }, { header: "Puntos", width: 10 }, { header: "Gastado", width: 14 },
            { header: "Pedidos", width: 10 }, { header: "Último pedido", width: 14 },
          ];
          data.rows.forEach((r) => ws.addRow([r.customerName, r.totalPoints, r.totalSpent, r.orderCount, r.lastOrderDate ?? "-"]));
        } else if (type === "credit_aging") {
          const data = await getCreditAging(guard.organizationId);
          ws.columns = [
            { header: "Cliente", width: 25 }, { header: "Saldo", width: 14 }, { header: "Límite", width: 14 },
            { header: "Días", width: 8 }, { header: "Segmento", width: 14 },
          ];
          data.rows.forEach((r) => ws.addRow([r.customerName, r.balance, r.creditLimit ?? "-", r.daysOverdue, r.agingBucket]));
        } else if (type === "promos_roi") {
          const data = await getPromotionsRoi(guard.organizationId, biFilters);
          ws.columns = [
            { header: "Promoción", width: 25 }, { header: "Descuento", width: 14 }, { header: "Ingresos", width: 14 },
            { header: "Pedidos", width: 10 }, { header: "ROI %", width: 10 },
          ];
          data.rows.forEach((r) => ws.addRow([r.promotionName, r.discountGiven, r.revenueGenerated, r.ordersCount, r.roi]));
        } else if (type === "low_stock") {
          const data = await getLowStockAlerts(guard.organizationId);
          ws.columns = [
            { header: "Producto", width: 25 }, { header: "Sucursal", width: 20 }, { header: "Stock", width: 10 },
            { header: "Mínimo", width: 10 }, { header: "Déficit", width: 10 },
          ];
          data.rows.forEach((r) => ws.addRow([r.productName, r.locationName, r.currentStock, r.minStock, r.deficit]));
        } else if (type === "margin") {
          const data = await getMarginAnalysis(guard.organizationId, biFilters);
          ws.columns = [
            { header: "Categoría", width: 25 }, { header: "Ingresos", width: 14 }, { header: "Costo", width: 14 },
            { header: "Margen", width: 14 }, { header: "Margen %", width: 10 },
          ];
          data.rows.forEach((r) => ws.addRow([r.categoryName, r.revenue, r.costOfGoods, r.margin, r.marginPct]));
        } else if (type === "daily_trend") {
          const data = await getDailyTrend(guard.organizationId, biFilters);
          ws.columns = [
            { header: "Fecha", width: 14 }, { header: "Ventas", width: 14 }, { header: "Pedidos", width: 10 },
            { header: "Ticket Prom.", width: 12 },
          ];
          data.rows.forEach((r) => ws.addRow([r.date, r.totalSales, r.orderCount, r.avgTicket]));
        } else if (type === "payment_mix") {
          const data = await getPaymentMix(guard.organizationId, biFilters);
          ws.columns = [
            { header: "Método", width: 20 }, { header: "Pedidos", width: 10 }, { header: "Total", width: 14 }, { header: "%", width: 8 },
          ];
          data.rows.forEach((r) => ws.addRow([r.method, r.count, r.total, r.pct]));
        } else if (type === "product_pairs") {
          const data = await getProductPairs(guard.organizationId, biFilters);
          ws.columns = [
            { header: "Producto A", width: 25 }, { header: "Producto B", width: 25 },
            { header: "Veces juntos", width: 12 }, { header: "Ingreso prom.", width: 14 },
          ];
          data.rows.forEach((r) => ws.addRow([r.productA, r.productB, r.timesTogether, r.avgRevenue]));
        } else if (type === "transfers") {
          const data = await getTransferEfficiency(guard.organizationId, biFilters);
          ws.columns = [
            { header: "Origen", width: 20 }, { header: "Destino", width: 20 },
            { header: "Estado", width: 14 }, { header: "Items", width: 8 },
            { header: "Cantidad", width: 10 }, { header: "Fecha", width: 14 },
          ];
          data.rows.forEach((r) => ws.addRow([r.fromLocation, r.toLocation, r.status, r.itemCount, r.totalQty, r.createdAt]));
        } else if (type === "fill_rate") {
          const data = await getInventoryFillRate(guard.organizationId);
          ws.columns = [
            { header: "Sucursal", width: 22 }, { header: "Total", width: 10 },
            { header: "Con stock", width: 10 }, { header: "Sin stock", width: 10 },
            { header: "Fill Rate %", width: 12 },
          ];
          data.rows.forEach((r) => ws.addRow([r.locationName, r.totalProducts, r.inStock, r.outOfStock, r.fillRate]));
        } else if (type === "employee_margin") {
          const data = await getEmployeeMargin(guard.organizationId, biFilters);
          ws.columns = [
            { header: "Empleado", width: 25 }, { header: "Ingresos", width: 14 },
            { header: "Costo", width: 14 }, { header: "Margen", width: 14 },
            { header: "Margen %", width: 10 }, { header: "Ventas", width: 8 },
          ];
          data.rows.forEach((r) => ws.addRow([r.employeeName, r.totalRevenue, r.totalCost, r.margin, r.marginPct, r.saleCount]));
        } else if (type === "forecast") {
          const data = await getSalesForecast(guard.organizationId);
          ws.columns = [
            { header: "Fecha", width: 14 }, { header: "Predicción", width: 14 }, { header: "Confianza %", width: 12 },
          ];
          data.rows.forEach((r) => ws.addRow([r.date, r.predictedSales, r.confidence]));
        }

        ws.getRow(1).font = { bold: true };
        ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F1F5F9" } };
        const buffer = Buffer.from(await wb.xlsx.writeBuffer());
        return new NextResponse(new Uint8Array(buffer), {
          headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="bi-${type}-${date}.xlsx"` },
        });
      }

      // PDF export for BI reports
      const { buildReportPdf } = await import("@/lib/reports/pdf");
      const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;

      if (type === "omnichannel") {
        const data = await getOmnichannelReport(guard.organizationId, biFilters);
        const buffer = await buildReportPdf({
          organizationName: org, title: "Ventas Omnicanal",
          columns: [
            { header: "Sucursal", width: 22, render: (r) => r.locationName },
            { header: "POS", width: 14, align: "right", render: (r) => money(r.posSales) },
            { header: "Portal", width: 14, align: "right", render: (r) => money(r.portalSales) },
            { header: "Total", width: 14, align: "right", render: (r) => money(r.total) },
            { header: "% Web", width: 10, align: "right", render: (r) => `${r.pctWeb}%` },
          ],
          rows: data.rows,
        });
        return new NextResponse(new Uint8Array(buffer), {
          headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="bi-omnichannel-${date}.pdf"` },
        });
      }

      if (type === "ranking") {
        const sort = (req.nextUrl.searchParams.get("sort") ?? "revenue") as "quantity" | "revenue" | "margin";
        const data = await getProductRanking(guard.organizationId, biFilters, sort);
        const ranked = data.rows.map((r, i) => ({ ...r, _rank: i + 1 }));
        const buffer = await buildReportPdf({
          organizationName: org, title: "Ranking de Productos",
          columns: [
            { header: "#", width: 5, render: (r) => String(r._rank) },
            { header: "Producto", width: 30, render: (r) => r.productName },
            { header: "Unidades", width: 10, align: "right", render: (r) => String(r.quantity) },
            { header: "Ingreso", width: 14, align: "right", render: (r) => money(r.revenue) },
            { header: "Margen", width: 14, align: "right", render: (r) => money(r.margin) },
          ],
          rows: ranked,
        });
        return new NextResponse(new Uint8Array(buffer), {
          headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="bi-ranking-${date}.pdf"` },
        });
      }

      // inventory
      const data = await getInventoryValuation(guard.organizationId, biFilters);
      const buffer = await buildReportPdf({
        organizationName: org, title: "Inventario Valorado",
        columns: [
          { header: "Categoría", width: 22, render: (r) => r.categoryName },
          { header: "Valor Costo", width: 14, align: "right", render: (r) => money(r.valueAtCost) },
          { header: "Valor Venta", width: 14, align: "right", render: (r) => money(r.valueAtRetail) },
          { header: "Productos", width: 10, align: "right", render: (r) => String(r.productCount) },
        ],
        rows: data.rows,
      });
      return new NextResponse(new Uint8Array(buffer), {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="bi-inventory-${date}.pdf"` },
      });
      return new NextResponse(new Uint8Array(buffer), {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="bi-${type}-${date}.pdf"` },
      });
    }

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