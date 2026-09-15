import type { SaleRow } from "@/lib/sales/server";
import { buildExecutiveReportPdf, type ExecutivePdfBranding } from "@/lib/reports/pdf";

const money = (value: number) => value.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export interface PdfSaleRows { organizationName: string; rows: SaleRow[]; branding?: ExecutivePdfBranding; }

export function buildSalesPdf({ organizationName, rows, branding }: PdfSaleRows): Promise<Buffer> {
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  return buildExecutiveReportPdf({
    organizationName, ...branding, period: "Periodo seleccionado", filters: ["Filtros aplicados en la consulta de ventas"],
    sections: [{
      title: "Ventas", description: "Detalle comercial de las ventas incluidas en la exportación.",
      metrics: [{ label: "Operaciones", value: String(rows.length) }, { label: "Importe total", value: money(total) }],
      analysis: `La selección contiene ${rows.length} ventas por un importe acumulado de ${money(total)}.`,
      columns: [{ key: "folio", label: "Folio" }, { key: "date", label: "Fecha" }, { key: "location", label: "Sucursal" }, { key: "customer", label: "Cliente" }, { key: "items", label: "Art.", align: "right" }, { key: "total", label: "Total", align: "right" }],
      rows: rows.map((row) => ({ folio: row.locationSaleNumber ?? row.saleNumber, date: new Date(row.createdAt).toLocaleDateString("es-MX"), location: row.locationName, customer: row.customerName ?? "—", items: row.itemCount, total: money(row.total) })),
    }],
  });
}
