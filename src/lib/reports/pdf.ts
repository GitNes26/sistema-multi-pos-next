import PDFDocument from "pdfkit";
import { buildInventoryPdf } from "@/lib/pdf";
import { buildSalesPdf } from "@/lib/sales/pdf";
import type { SalesReportRow } from "@/lib/reports/server";

// FASE 10.3/10.5 — Generadores PDF para reportes (reutilizan pdfkit y los builders existentes).

export interface PdfTableColumn<T> {
  header: string;
  width: number;
  align?: "left" | "right";
  render: (row: T) => string;
}

export interface PdfTableConfig<T> {
  organizationName: string;
  title: string;
  subtitle?: string;
  columns: PdfTableColumn<T>[];
  rows: T[];
  summary?: { label: string; value: string }[];
}

const INDIGO = "1e40af";
const SLATE_HEAD = "1e293b";
const SLATE_ROW = "f8fafc";
const MUTED = "64748b";
const DARK = "0f172a";

const clamp = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function buildReportPdf<T>({
  organizationName,
  title,
  subtitle,
  columns,
  rows,
  summary,
}: PdfTableConfig<T>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - 80;

    doc.rect(0, 0, doc.page.width, 64).fill(INDIGO);
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor("white")
      .text(organizationName || title, 40, 16, { width: W - 120 });
    doc.font("Helvetica").fontSize(10).fillColor("white").text(title, 40, 38, { width: W - 120 });

    let y = 80;
    doc.font("Helvetica").fontSize(8).fillColor(MUTED);
    doc.text(subtitle ?? `Generado el ${new Date().toLocaleString("es-MX")}`, 40, y, { width: W });

    if (summary && summary.length) {
      y += 18;
      doc.font("Helvetica").fontSize(9).fillColor(DARK);
      doc.text(
        summary.map((s) => `${s.label}: ${s.value}`).join("   ·   "),
        40,
        y,
        { width: W }
      );
      y += 18;
    } else {
      y += 18;
    }

    const h = 22;
    const colWidths = columns.map((c) => c.width);
    const totalW = colWidths.reduce((a, b) => a + b, 0);
    const startX = 40 + Math.max(0, (W - totalW) / 2);

    const drawHeader = () => {
      doc.rect(40, y, W, h).fill(SLATE_HEAD);
      doc.fillColor("white").font("Helvetica-Bold").fontSize(8);
      let x = startX;
      columns.forEach((c, i) => {
        doc.text(c.header.toUpperCase(), x + 4, y + 7, { width: c.width - 8, align: c.align ?? "left" });
        x += c.width;
      });
      y += h;
    };

    drawHeader();

    doc.font("Helvetica").fontSize(8);
    rows.forEach((r, i) => {
      if (y + h > doc.page.height - 56) {
        doc.addPage();
        y = 40;
        drawHeader();
        doc.font("Helvetica").fontSize(8);
      }

      if (i % 2 === 1) doc.rect(40, y, W, h).fill(SLATE_ROW);

      let x = startX;
      columns.forEach((c) => {
        const value = c.render(r);
        doc.fillColor(DARK).text(clamp(value, Math.floor(c.width / 4.6) + 8), x + 4, y + 7, {
          width: c.width - 8,
          align: c.align ?? "left",
        });
        x += c.width;
      });

      y += h;
    });

    doc.fillColor(MUTED).font("Helvetica").fontSize(8);
    doc.text(
      `Generado por el sistema Multi-POS · ${new Date().toLocaleString("es-MX")}`,
      40,
      doc.page.height - 46,
      { width: W, align: "center" }
    );

    doc.end();
  });
}

export function buildSalesReportPdf(
  organizationName: string,
  rows: SalesReportRow[]
): Promise<Buffer> {
  const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
  const total = rows.reduce((a, r) => a + r.total, 0);
  return buildReportPdf({
    organizationName,
    title: "Reporte de ventas",
    summary: [{ label: "Ventas", value: String(rows.length) }, { label: "Total", value: money(total) }],
    columns: [
      { header: "Folio", width: 50, render: (r) => String(r.folio) },
      { header: "Fecha", width: 90, render: (r) => new Date(r.date).toLocaleString("es-MX") },
      { header: "Sucursal", width: 110, render: (r) => r.locationName },
      { header: "Cliente", width: 110, render: (r) => r.customerName ?? "—" },
      { header: "Total", width: 80, align: "right", render: (r) => money(r.total) },
    ],
    rows,
  });
}

export function buildCashReportPdf(
  organizationName: string,
  rows: { registerName: string | null; locationName: string; employeeName: string | null; openedAt: string | null; closedAt: string | null; status: string; salesCount: number; totalSales: number; expectedCash: number; closingCash: number | null; difference: number | null }[]
): Promise<Buffer> {
  const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
  const totalSales = rows.reduce((a, r) => a + r.totalSales, 0);
  return buildReportPdf({
    organizationName,
    title: "Corte de caja",
    summary: [{ label: "Sesiones", value: String(rows.length) }, { label: "Ventas", value: money(totalSales) }],
    columns: [
      { header: "Caja", width: 70, render: (r) => r.registerName ?? "—" },
      { header: "Sucursal", width: 110, render: (r) => r.locationName },
      { header: "Cajero", width: 110, render: (r) => r.employeeName ?? "—" },
      { header: "Apertura", width: 90, render: (r) => (r.openedAt ? new Date(r.openedAt).toLocaleString("es-MX") : "—") },
      { header: "Ventas", width: 70, align: "right", render: (r) => money(r.totalSales) },
      { header: "Esperado", width: 70, align: "right", render: (r) => money(r.expectedCash) },
      { header: "Dif.", width: 60, align: "right", render: (r) => (r.difference == null ? "—" : money(r.difference)) },
    ],
    rows,
  });
}

export function buildOrdersReportPdf(
  organizationName: string,
  rows: { orderNumber: number; status: string; deliveryMethod: string; customerName: string | null; locationName: string | null; total: number; createdAt: string }[]
): Promise<Buffer> {
  const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
  return buildReportPdf({
    organizationName,
    title: "Reporte de pedidos",
    summary: [{ label: "Pedidos", value: String(rows.length) }],
    columns: [
      { header: "Pedido", width: 60, render: (r) => `#${r.orderNumber}` },
      { header: "Fecha", width: 90, render: (r) => new Date(r.createdAt).toLocaleString("es-MX") },
      { header: "Cliente", width: 120, render: (r) => r.customerName ?? "—" },
      { header: "Entrega", width: 80, render: (r) => (r.deliveryMethod === "delivery" ? "Domicilio" : "Sucursal") },
      { header: "Estado", width: 90, render: (r) => r.status },
      { header: "Total", width: 80, align: "right", render: (r) => money(r.total) },
    ],
    rows,
  });
}

export function buildCustomersReportPdf(
  organizationName: string,
  rows: { fullName: string; customerCode: string | null; phone: string | null; points: number; salesCount: number; totalSpent: number }[]
): Promise<Buffer> {
  const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
  return buildReportPdf({
    organizationName,
    title: "Reporte de clientes",
    summary: [{ label: "Clientes", value: String(rows.length) }],
    columns: [
      { header: "Cliente", width: 180, render: (r) => r.fullName },
      { header: "Nº", width: 70, render: (r) => r.customerCode ?? "—" },
      { header: "Compras", width: 70, align: "right", render: (r) => String(r.salesCount) },
      { header: "Puntos", width: 70, align: "right", render: (r) => String(r.points) },
      { header: "Total", width: 90, align: "right", render: (r) => money(r.totalSpent) },
    ],
    rows,
  });
}

export { buildInventoryPdf };
export { buildSalesPdf };
