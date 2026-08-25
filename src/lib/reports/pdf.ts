import PDFDocument from "pdfkit";

// FASE 10.3/10.5 — Generadores PDF para reportes (pdfkit, server-side).

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
const SLATE_ROW = "f1f5f9";
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

    // Header bar
    doc.rect(0, 0, doc.page.width, 64).fill(INDIGO);
    doc.font("Helvetica-Bold").fontSize(16).fillColor("white");
    doc.text(organizationName || title, 40, 16, { width: W - 120 });
    doc.font("Helvetica").fontSize(10).fillColor("white");
    doc.text(title, 40, 38, { width: W - 120 });

    // Subtitle
    let y = 80;
    doc.font("Helvetica").fontSize(8).fillColor(MUTED);
    doc.text(subtitle ?? `Generado el ${new Date().toLocaleString("es-MX")}`, 40, y, { width: W });
    y += 18;

    // Summary line
    if (summary && summary.length) {
      doc.font("Helvetica").fontSize(9).fillColor(DARK);
      const summaryText = summary.map((s) => `${s.label}: ${s.value}`).join("   ·   ");
      doc.text(summaryText, 40, y, { width: W });
      y += 18;
    }

    // No data
    if (!rows || rows.length === 0) {
      doc.font("Helvetica").fontSize(10).fillColor(MUTED);
      doc.text("No hay datos para los filtros seleccionados.", 40, y + 10, { width: W, align: "center" });
      doc.fillColor(MUTED).font("Helvetica").fontSize(8);
      doc.text(
        `Generado por el sistema Multi-POS · ${new Date().toLocaleString("es-MX")}`,
        40,
        doc.page.height - 46,
        { width: W, align: "center" }
      );
      doc.end();
      return;
    }

    // Table
    const ROW_H = 22;
    const startX = 40;

    // Draw table header
    const drawTableHeader = (atY: number) => {
      doc.rect(startX, atY, W, ROW_H).fill(SLATE_HEAD);
      let cx = startX;
      for (const c of columns) {
        doc.font("Helvetica-Bold").fontSize(8).fillColor("white");
        if (c.align === "right") {
          doc.text(c.header.toUpperCase(), cx, atY + 6, { width: c.width - 8, align: "right" });
        } else {
          doc.text(c.header.toUpperCase(), cx + 6, atY + 6, { width: c.width - 12, align: "left" });
        }
        cx += c.width;
      }
    };

    drawTableHeader(y);
    y += ROW_H;
    doc.fillColor(DARK);

    // Draw data rows — each column as a separate text call at fixed coordinates
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];

      // Page break
      if (y + ROW_H > doc.page.height - 56) {
        doc.addPage();
        y = 40;
        drawTableHeader(y);
        y += ROW_H;
      }

      // Alternating row background
      if (i % 2 === 1) {
        doc.save();
        doc.rect(startX, y, W, ROW_H).fill(SLATE_ROW);
        doc.restore();
      }

      // Render each cell
      let cx = startX;
      for (const c of columns) {
        const value = clamp(c.render(r), Math.floor((c.width - 12) / 4.2) + 2);
        doc.font("Helvetica").fontSize(8).fillColor(DARK);
        if (c.align === "right") {
          doc.text(value, cx, y + 6, { width: c.width - 8, align: "right" });
        } else {
          doc.text(value, cx + 6, y + 6, { width: c.width - 12, align: "left" });
        }
        cx += c.width;
      }

      y += ROW_H;
    }

    // Footer
    doc.save();
    doc.fillColor(MUTED).font("Helvetica").fontSize(8);
    doc.text(
      `Generado por el sistema Multi-POS · ${new Date().toLocaleString("es-MX")}`,
      40,
      doc.page.height - 46,
      { width: W, align: "center" }
    );
    doc.restore();

    doc.end();
  });
}

export function buildSalesReportPdf(
  organizationName: string,
  rows: { folio: number; date: string; locationName: string; customerName: string | null; total: number }[]
): Promise<Buffer> {
  const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
  const total = rows.reduce((a, r) => a + r.total, 0);
  return buildReportPdf({
    organizationName,
    title: "Reporte de ventas",
    summary: [{ label: "Ventas", value: String(rows.length) }, { label: "Total", value: money(total) }],
    columns: [
      { header: "Folio", width: 55, render: (r) => String(r.folio) },
      { header: "Fecha", width: 120, render: (r) => new Date(r.date).toLocaleString("es-MX") },
      { header: "Sucursal", width: 140, render: (r) => r.locationName },
      { header: "Cliente", width: 120, render: (r) => r.customerName ?? "—" },
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
      { header: "Caja", width: 60, render: (r) => r.registerName ?? "—" },
      { header: "Sucursal", width: 100, render: (r) => r.locationName },
      { header: "Cajero", width: 90, render: (r) => r.employeeName ?? "—" },
      { header: "Apertura", width: 90, render: (r) => (r.openedAt ? new Date(r.openedAt).toLocaleString("es-MX") : "—") },
      { header: "Ventas", width: 55, align: "right", render: (r) => money(r.totalSales) },
      { header: "Esperado", width: 60, align: "right", render: (r) => money(r.expectedCash) },
      { header: "Dif.", width: 50, align: "right", render: (r) => (r.difference == null ? "—" : money(r.difference)) },
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
      { header: "Pedido", width: 55, render: (r) => `#${r.orderNumber}` },
      { header: "Fecha", width: 110, render: (r) => new Date(r.createdAt).toLocaleString("es-MX") },
      { header: "Cliente", width: 110, render: (r) => r.customerName ?? "—" },
      { header: "Entrega", width: 80, render: (r) => (r.deliveryMethod === "delivery" ? "Domicilio" : "Sucursal") },
      { header: "Estado", width: 75, render: (r) => r.status },
      { header: "Total", width: 70, align: "right", render: (r) => money(r.total) },
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
      { header: "Cliente", width: 160, render: (r) => r.fullName },
      { header: "Nº", width: 80, render: (r) => r.customerCode ?? "—" },
      { header: "Compras", width: 70, align: "right", render: (r) => String(r.salesCount) },
      { header: "Puntos", width: 70, align: "right", render: (r) => String(r.points) },
      { header: "Total", width: 100, align: "right", render: (r) => money(r.totalSpent) },
    ],
    rows,
  });
}

export { buildInventoryPdf } from "@/lib/pdf";
export { buildSalesPdf } from "@/lib/sales/pdf";
