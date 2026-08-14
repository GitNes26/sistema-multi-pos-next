import PDFDocument from "pdfkit";
import type { SaleRow } from "@/lib/sales/server";

// FASE 9.6 — Exportación de ventas en PDF profesional (pdfkit, server-side).

export interface PdfSaleRows {
  organizationName: string;
  rows: SaleRow[];
}

const INDIGO = "1e40af";
const SLATE_HEAD = "1e293b";
const SLATE_ROW = "f8fafc";
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
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor("white")
      .text(organizationName || "Reporte de ventas", 40, 16, { width: W - 120 });
    doc.font("Helvetica").fontSize(10).fillColor("white").text("Reporte de ventas", 40, 38, { width: W - 120 });

    if (rows.length === 0) {
      doc.font("Helvetica").fontSize(10).fillColor(DARK);
      doc.text("No hay ventas para los filtros seleccionados.", 40, 90);
      doc.end();
      return;
    }

    // Summary
    const totalVentas = rows.reduce((acc, r) => acc + r.total, 0);
    doc.font("Helvetica").fontSize(9).fillColor(DARK);
    doc.text(`Total de ventas: ${rows.length}`, 40, 78, { continued: true });
    doc.fillColor(MUTED).text("   ·   Importe total: ", { continued: true });
    doc.fillColor(DARK).text(money(totalVentas));

    // Table
    let y = 108;
    const h = 22;
    doc.rect(40, y, W, h).fill(SLATE_HEAD);
    doc.fillColor("white").font("Helvetica-Bold").fontSize(8);
    const col = (x: number, w: number, t: string, align: "left" | "right" = "left") =>
      doc.text(t, x, y + 7, { width: w, align });
    col(48, 50, "FOLIO");
    col(100, 92, "FECHA");
    col(196, 120, "SUCURSAL");
    col(318, 90, "CLIENTE");
    col(410, 62, "ART.", "right");
    col(472, 82, "TOTAL", "right");
    y += h;

    doc.font("Helvetica").fontSize(8);
    rows.forEach((r, i) => {
      if (y + h > doc.page.height - 56) {
        doc.addPage();
        y = 40;
        doc.rect(40, y, W, h).fill(SLATE_HEAD);
        doc.fillColor("white").font("Helvetica-Bold").fontSize(8);
        col(48, 50, "FOLIO");
        col(100, 92, "FECHA");
        col(196, 120, "SUCURSAL");
        col(318, 90, "CLIENTE");
        col(410, 62, "ART.", "right");
        col(472, 82, "TOTAL", "right");
        y += h;
        doc.font("Helvetica").fontSize(8);
      }

      if (i % 2 === 1) doc.rect(40, y, W, h).fill(SLATE_ROW);

      doc.fillColor(DARK).font("Helvetica-Bold").text(String(r.locationSaleNumber ?? r.saleNumber), 48, y + 7, { width: 50 });
      doc.font("Helvetica").fillColor(MUTED).text(new Date(r.createdAt).toLocaleString("es-MX"), 100, y + 7, { width: 92 });
      doc.fillColor(DARK).text(r.locationName, 196, y + 7, { width: 120 });
      doc.text(r.customerName ?? "—", 318, y + 7, { width: 90 });
      doc.text(String(r.itemCount), 410, y + 7, { width: 62, align: "right" });
      doc.font("Helvetica-Bold").text(money(r.total), 472, y + 7, { width: 82, align: "right" });
      doc.font("Helvetica");

      y += h;
    });

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