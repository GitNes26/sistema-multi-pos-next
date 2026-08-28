import PDFDocument from "pdfkit";
import path from "path";
import type { SaleRow } from "@/lib/sales/server";

// ── Colores ──
const INDIGO = "#1e40af";
const SLATE_HEAD = "#1e293b";
const SLATE_ROW = "#f1f5f9";
const MUTED = "#64748b";
const DARK = "#0f172a";
const WHITE = "#ffffff";

const FONT = path.join(process.cwd(), "public", "fonts", "Roboto-Regular.ttf");

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const safe = (v: unknown): string => (v == null ? "—" : String(v));

export interface PdfSaleRows {
  organizationName: string;
  rows: SaleRow[];
}

export function buildSalesPdf({ organizationName, rows }: PdfSaleRows): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
    doc.registerFont("Roboto", FONT);

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const m = 40;
    const W = doc.page.width - m * 2;
    const h = 22;

    // ── Header ──
    doc.rect(0, 0, doc.page.width, 64).fill(INDIGO);
    doc.font("Roboto").fontSize(16).fillColor(WHITE);
    doc.text(safe(organizationName || "Reporte de ventas"), m, 16, { width: W - 120, lineBreak: false });
    doc.fontSize(10);
    doc.text("Reporte de ventas", m, 38, { width: W - 120, lineBreak: false });

    if (!rows.length) {
      doc.fontSize(10).fillColor(DARK);
      doc.text("No hay ventas para los filtros seleccionados.", m, 90);
      addFooter(doc, m, W);
      doc.end();
      return;
    }

    // ── Summary ──
    const totalVentas = rows.reduce((acc, r) => acc + r.total, 0);
    let y = 78;
    doc.font("Roboto").fontSize(9).fillColor(DARK);
    doc.text(`Total de ventas: ${rows.length}   ·   Importe total: ${money(totalVentas)}`, m, y, { width: W });
    y += 22;

    // ── Table header ──
    const drawHeader = () => {
      doc.rect(m, y, W, h).fill(SLATE_HEAD);
      doc.font("Roboto").fontSize(8).fillColor(WHITE);
      doc.text("FOLIO", m + 8, y + 6, { width: 50, lineBreak: false });
      doc.text("FECHA", m + 60, y + 6, { width: 92, lineBreak: false });
      doc.text("SUCURSAL", m + 156, y + 6, { width: 120, lineBreak: false });
      doc.text("CLIENTE", m + 280, y + 6, { width: 90, lineBreak: false });
      doc.text("ART.", m + 372, y + 6, { width: 45, align: "right", lineBreak: false });
      doc.text("TOTAL", m + 420, y + 6, { width: 75, align: "right", lineBreak: false });
      y += h;
    };

    drawHeader();

    // ── Data rows ──
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (y + h > doc.page.height - 56) {
        doc.addPage();
        y = m;
        drawHeader();
      }

      if (i % 2 === 1) {
        doc.rect(m, y, W, h).fill(SLATE_ROW);
      }

      doc.font("Roboto").fontSize(8).fillColor(DARK);
      doc.text(safe(String(r.locationSaleNumber ?? r.saleNumber)), m + 8, y + 6, { width: 50, lineBreak: false });
      doc.fillColor(MUTED);
      doc.text(safe(new Date(r.createdAt).toLocaleDateString("es-MX")), m + 60, y + 6, { width: 92, lineBreak: false });
      doc.fillColor(DARK);
      doc.text(safe(r.locationName), m + 156, y + 6, { width: 120, lineBreak: false });
      doc.text(safe(r.customerName ?? "—"), m + 280, y + 6, { width: 90, lineBreak: false });
      doc.text(safe(String(r.itemCount)), m + 372, y + 6, { width: 45, align: "right", lineBreak: false });
      doc.font("Roboto").fontSize(8).fillColor(DARK);
      doc.text(safe(money(r.total)), m + 420, y + 6, { width: 75, align: "right", lineBreak: false });

      y += h;
    }

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
