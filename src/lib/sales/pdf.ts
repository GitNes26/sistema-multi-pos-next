import PDFDocument from "pdfkit";
import type { SaleRow } from "@/lib/sales/server";

// FASE 9.6 — Exportación de ventas en PDF profesional (pdfkit, server-side).

export interface PdfSaleRows {
  organizationName: string;
  rows: SaleRow[];
}

const INDIGO = "1e40af";
const SLATE_HEAD = "1e293b";
const SLATE_ROW = "f1f5f9";
const MUTED = "64748b";
const DARK = "0f172a";

const money = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

export function buildSalesPdf({ organizationName, rows }: PdfSaleRows): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - 80;

    // Header
    doc.rect(0, 0, doc.page.width, 64).fill(INDIGO);
    doc.font("Helvetica-Bold").fontSize(16).fillColor("white");
    doc.text(organizationName || "Reporte de ventas", 40, 16, { width: W - 120 });
    doc.font("Helvetica").fontSize(10).fillColor("white");
    doc.text("Reporte de ventas", 40, 38, { width: W - 120 });

    if (rows.length === 0) {
      doc.font("Helvetica").fontSize(10).fillColor(DARK);
      doc.text("No hay ventas para los filtros seleccionados.", 40, 90);
      doc.end();
      return;
    }

    // Summary
    const totalVentas = rows.reduce((acc, r) => acc + r.total, 0);
    let y = 78;
    doc.font("Helvetica").fontSize(9).fillColor(DARK);
    doc.text(`Total de ventas: ${rows.length}   ·   Importe total: ${money(totalVentas)}`, 40, y, { width: W });
    y += 22;

    // Table header
    const h = 22;
    const drawHeader = () => {
      doc.rect(40, y, W, h).fill(SLATE_HEAD);
      doc.fillColor("white").font("Helvetica-Bold").fontSize(8);
      doc.text("FOLIO", 48, y + 6, { width: 50, align: "left" });
      doc.text("FECHA", 100, y + 6, { width: 92, align: "left" });
      doc.text("SUCURSAL", 196, y + 6, { width: 120, align: "left" });
      doc.text("CLIENTE", 318, y + 6, { width: 90, align: "left" });
      doc.text("ART.", 410, y + 6, { width: 55, align: "right" });
      doc.text("TOTAL", 472, y + 6, { width: 82, align: "right" });
      y += h;
    };

    drawHeader();

    // Table rows
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (y + h > doc.page.height - 56) {
        doc.addPage();
        y = 40;
        drawHeader();
      }

      if (i % 2 === 1) {
        doc.save();
        doc.rect(40, y, W, h).fill(SLATE_ROW);
        doc.restore();
      }

      doc.font("Helvetica-Bold").fontSize(8).fillColor(DARK);
      doc.text(String(r.locationSaleNumber ?? r.saleNumber), 48, y + 6, { width: 50 });
      doc.font("Helvetica").fillColor(MUTED);
      doc.text(new Date(r.createdAt).toLocaleString("es-MX"), 100, y + 6, { width: 92 });
      doc.fillColor(DARK);
      doc.text(r.locationName, 196, y + 6, { width: 120 });
      doc.text(r.customerName ?? "—", 318, y + 6, { width: 90 });
      doc.text(String(r.itemCount), 410, y + 6, { width: 55, align: "right" });
      doc.font("Helvetica-Bold");
      doc.text(money(r.total), 472, y + 6, { width: 82, align: "right" });
      doc.font("Helvetica");

      y += h;
    }

    // Footer
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
