import PDFDocument from "pdfkit";
import path from "path";

// ── Colores del tema ──────────────────────────────────────────────────────────
const INDIGO = "#1e40af";
const SLATE_HEAD = "#1e293b";
const SLATE_ROW = "#f1f5f9";
const MUTED = "#64748b";
const DARK = "#0f172a";
const WHITE = "#ffffff";

// ── Fuente Roboto (soporta acentos, ñ, etc.) ─────────────────────────────────
const FONT_REGULAR = path.join(process.cwd(), "public", "fonts", "Roboto-Regular.ttf");

function registerFonts(doc: PDFKit.PDFDocument) {
  doc.registerFont("Roboto", FONT_REGULAR);
}

// ── Utilidades ────────────────────────────────────────────────────────────────
const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const safe = (v: unknown): string => (v == null ? "—" : String(v));
const clamp = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + "…" : s);

// ── Interfaz pública ──────────────────────────────────────────────────────────
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

// ── Constructor genérico de reportes ──────────────────────────────────────────
export function buildReportPdf<T>({
  organizationName,
  title,
  subtitle,
  columns,
  rows,
  summary,
}: PdfTableConfig<T>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
    registerFonts(doc);

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width;
    const m = 40;
    const W = pageW - m * 2;
    const ROW_H = 22;

    // ── Barra de encabezado ──
    doc.rect(0, 0, pageW, 64).fill(INDIGO);
    doc.font("Roboto").fontSize(16).fillColor(WHITE);
    doc.text(safe(organizationName || title), m, 16, { width: W - 120, lineBreak: false });
    doc.fontSize(10);
    doc.text(safe(title), m, 38, { width: W - 120, lineBreak: false });

    // ── Subtítulo ──
    let y = 80;
    doc.fontSize(8).fillColor(MUTED);
    doc.text(subtitle ?? `Generado el ${new Date().toLocaleDateString("es-MX")} a las ${new Date().toLocaleTimeString("es-MX")}`, m, y, { width: W });
    y += 18;

    // ── Línea de resumen ──
    if (summary?.length) {
      doc.fontSize(9).fillColor(DARK);
      doc.text(summary.map((s) => `${s.label}: ${s.value}`).join("   ·   "), m, y, { width: W });
      y += 18;
    }

    // ── Sin datos ──
    if (!rows?.length) {
      doc.fontSize(10).fillColor(MUTED);
      doc.text("No hay datos para los filtros seleccionados.", m, y + 10, { width: W, align: "center" });
      addFooter(doc, m, W);
      doc.end();
      return;
    }

    // ── Dibujar encabezado de tabla ──
    const drawHeader = (atY: number) => {
      doc.rect(m, atY, W, ROW_H).fill(SLATE_HEAD);
      let cx = m;
      for (const c of columns) {
        doc.font("Roboto").fontSize(8).fillColor(WHITE);
        const tx = c.align === "right" ? cx : cx + 6;
        const tw = c.align === "right" ? c.width - 8 : c.width - 12;
        doc.text(c.header.toUpperCase(), tx, atY + 6, {
          width: tw,
          align: c.align === "right" ? "right" : "left",
          lineBreak: false,
        });
        cx += c.width;
      }
    };

    drawHeader(y);
    y += ROW_H;

    // ── Filas de datos ──
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];

      // Salto de página
      if (y + ROW_H > doc.page.height - 56) {
        doc.addPage();
        y = m;
        drawHeader(y);
        y += ROW_H;
      }

      // Fondo alternado
      if (i % 2 === 1) {
        doc.rect(m, y, W, ROW_H).fill(SLATE_ROW);
      }

      // Celdas
      let cx = m;
      for (const c of columns) {
        let value = "—";
        try {
          value = clamp(safe(c.render(r)), Math.floor((c.width - 12) / 5) + 2);
        } catch { /* render error → dash */ }

        doc.font("Roboto").fontSize(8).fillColor(DARK);
        const tx = c.align === "right" ? cx : cx + 6;
        const tw = c.align === "right" ? c.width - 8 : c.width - 12;
        doc.text(value, tx, y + 6, {
          width: tw,
          align: c.align === "right" ? "right" : "left",
          lineBreak: false,
        });
        cx += c.width;
      }

      y += ROW_H;
    }

    // ── Footer en todas las páginas ──
    addFooter(doc, m, W);
    doc.end();
  });
}

function addFooter(doc: PDFKit.PDFDocument, m: number, W: number) {
  const pages = doc.bufferedPageRange();
  for (let p = pages.start; p < pages.start + pages.count; p++) {
    doc.switchToPage(p);
    doc.font("Roboto").fontSize(8).fillColor(MUTED);
    doc.text(
      `Generado por Multi-POS · ${new Date().toLocaleDateString("es-MX")} ${new Date().toLocaleTimeString("es-MX")}`,
      m, doc.page.height - 46, { width: W, align: "center" }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// builders especializados
// ═══════════════════════════════════════════════════════════════════════════════

export function buildSalesReportPdf(
  orgName: string,
  rows: { folio: number; date: string; locationName: string; customerName: string | null; total: number }[],
  returnsTotal = 0
): Promise<Buffer> {
  const total = rows.reduce((a, r) => a + r.total, 0);
  const net = total - returnsTotal;
  const summary = [
    { label: "Ventas", value: String(rows.length) },
    { label: "Total bruto", value: money(total) },
  ];
  if (returnsTotal > 0) {
    summary.push({ label: "Devoluciones", value: `-${money(returnsTotal)}` });
    summary.push({ label: "Total neto", value: money(net) });
  }
  return buildReportPdf({
    organizationName: orgName,
    title: "Reporte de ventas",
    summary,
    columns: [
      { header: "Folio", width: 55, render: (r) => String(r.folio) },
      { header: "Fecha", width: 120, render: (r) => new Date(r.date).toLocaleDateString("es-MX") },
      { header: "Sucursal", width: 140, render: (r) => r.locationName },
      { header: "Cliente", width: 120, render: (r) => r.customerName ?? "—" },
      { header: "Total", width: 80, align: "right", render: (r) => money(r.total) },
    ],
    rows,
  });
}

export function buildCashReportPdf(
  orgName: string,
  rows: { registerName: string | null; locationName: string; employeeName: string | null; openedAt: string | null; closedAt: string | null; status: string; salesCount: number; totalSales: number; expectedCash: number; closingCash: number | null; difference: number | null }[]
): Promise<Buffer> {
  const totalSales = rows.reduce((a, r) => a + r.totalSales, 0);
  return buildReportPdf({
    organizationName: orgName,
    title: "Corte de caja",
    summary: [{ label: "Sesiones", value: String(rows.length) }, { label: "Ventas", value: money(totalSales) }],
    columns: [
      { header: "Caja", width: 60, render: (r) => r.registerName ?? "—" },
      { header: "Sucursal", width: 100, render: (r) => r.locationName },
      { header: "Cajero", width: 90, render: (r) => r.employeeName ?? "—" },
      { header: "Apertura", width: 90, render: (r) => r.openedAt ? new Date(r.openedAt).toLocaleDateString("es-MX") : "—" },
      { header: "Ventas", width: 55, align: "right", render: (r) => money(r.totalSales) },
      { header: "Esperado", width: 60, align: "right", render: (r) => money(r.expectedCash) },
      { header: "Dif.", width: 50, align: "right", render: (r) => r.difference == null ? "—" : money(r.difference) },
    ],
    rows,
  });
}

export function buildOrdersReportPdf(
  orgName: string,
  rows: { orderNumber: number; status: string; deliveryMethod: string; customerName: string | null; locationName: string | null; total: number; createdAt: string }[]
): Promise<Buffer> {
  return buildReportPdf({
    organizationName: orgName,
    title: "Reporte de pedidos",
    summary: [{ label: "Pedidos", value: String(rows.length) }],
    columns: [
      { header: "Pedido", width: 55, render: (r) => `#${r.orderNumber}` },
      { header: "Fecha", width: 110, render: (r) => new Date(r.createdAt).toLocaleDateString("es-MX") },
      { header: "Cliente", width: 110, render: (r) => r.customerName ?? "—" },
      { header: "Entrega", width: 80, render: (r) => r.deliveryMethod === "delivery" ? "Domicilio" : "Sucursal" },
      { header: "Estado", width: 75, render: (r) => r.status },
      { header: "Total", width: 70, align: "right", render: (r) => money(r.total) },
    ],
    rows,
  });
}

export function buildCustomersReportPdf(
  orgName: string,
  rows: { fullName: string; customerCode: string | null; phone: string | null; points: number; salesCount: number; totalSpent: number }[]
): Promise<Buffer> {
  return buildReportPdf({
    organizationName: orgName,
    title: "Reporte de clientes",
    summary: [{ label: "Clientes", value: String(rows.length) }],
    columns: [
      { header: "Cliente", width: 160, render: (r) => r.fullName },
      { header: "N°", width: 80, render: (r) => r.customerCode ?? "—" },
      { header: "Compras", width: 70, align: "right", render: (r) => String(r.salesCount) },
      { header: "Puntos", width: 70, align: "right", render: (r) => String(r.points) },
      { header: "Total", width: 100, align: "right", render: (r) => money(r.totalSpent) },
    ],
    rows,
  });
}

export { buildInventoryPdf } from "@/lib/pdf";
export { buildSalesPdf } from "@/lib/sales/pdf";
