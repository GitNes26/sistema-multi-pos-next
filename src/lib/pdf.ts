import PDFDocument from "pdfkit";

// FASE 8.7 — Exportación de inventario en PDF profesional (pdfkit, server-side).

export interface PdfInventoryRow {
  productName: string;
  variantName: string | null;
  sku: string | null;
  unit: string | null;
  quantity: number;
  minThreshold: number;
  status: "ok" | "low" | "empty";
}

export interface PdfInventoryConfig {
  organizationName: string;
  locationName: string;
  generatedAt: Date;
  rows: PdfInventoryRow[];
}

const INDIGO = "1e40af";
const SLATE_HEAD = "1e293b";
const SLATE_ROW = "f8fafc";
const MUTED = "64748b";
const DARK = "0f172a";

const clamp = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function buildInventoryPdf({
  organizationName,
  locationName,
  generatedAt,
  rows,
}: PdfInventoryConfig): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - 80;
    const label = (y: number, text: string, value: string) => {
      doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(text, 40, y, { width: 110 });
      doc.fillColor(DARK).text(value, 120, y, { width: W - 80 });
    };

    // Header
    doc.rect(0, 0, doc.page.width, 64).fill(INDIGO);
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor("white")
      .text(organizationName || "Reporte de inventario", 40, 16, { width: W - 120 });
    doc.font("Helvetica").fontSize(10).fillColor("white").text("Reporte de inventario", 40, 38, { width: W - 120 });

    label(78, "Sucursal / CEDIS:", locationName);
    label(96, "Generado:", generatedAt.toLocaleString("es-MX"));

    // Summary
    const low = rows.filter((r) => r.status === "low").length;
    const empty = rows.filter((r) => r.status === "empty").length;
    doc.font("Helvetica").fontSize(9).fillColor(DARK);
    doc.text(`Total de productos: ${rows.length}`, 40, 122, { continued: true });
    doc.fillColor(MUTED).text(`   ·   Stock bajo: `, { continued: true });
    doc.fillColor(low > 0 ? "b45309" : MUTED).text(`${low}`, { continued: true });
    doc.fillColor(MUTED).text(`   ·   Sin stock: `, { continued: true });
    doc.fillColor(empty > 0 ? "b91c1c" : MUTED).text(`${empty}`);

    // Column headers
    let y = 148;
    const h = 24;
    doc.rect(40, y, W, h).fill(SLATE_HEAD);
    doc.fillColor("white").font("Helvetica-Bold").fontSize(8.5);
    const col = (x: number, w: number, t: string, align: "left" | "right" = "left") => {
      const opts: Record<string, unknown> = { width: w, align };
      doc.text(t, x, y + 8, opts);
    };
    col(50, 190, "PRODUCTO");
    col(240, 140, "VARIANTE / SKU");
    col(380, 50, "UNIDAD");
    col(430, 70, "EXISTENCIA", "right");
    col(500, 55, "MÍNIMO", "right");
    y += h;

    // Rows
    doc.font("Helvetica").fontSize(8.5);
    rows.forEach((r, i) => {
      if (y + h > doc.page.height - 56) {
        doc.addPage();
        y = 40;
        doc.rect(40, y, W, h).fill(SLATE_HEAD);
        doc.fillColor("white").font("Helvetica-Bold").fontSize(8.5);
        col(50, 190, "PRODUCTO");
        col(240, 140, "VARIANTE / SKU");
        col(380, 50, "UNIDAD");
        col(430, 70, "EXISTENCIA", "right");
        col(500, 55, "MÍNIMO", "right");
        y += h;
        doc.font("Helvetica").fontSize(8.5);
      }

      if (i % 2 === 1) doc.rect(40, y, W, h).fill(SLATE_ROW);

      doc.fillColor(DARK);
      doc.text(clamp(r.productName, 40), 50, y + 8, { width: 190 });
      doc.fillColor(MUTED);
      const variant = r.variantName
        ? `${r.variantName}${r.sku ? ` · ${r.sku}` : ""}`
        : r.sku ?? "—";
      doc.text(clamp(variant, 34), 240, y + 8, { width: 140 });
      doc.fillColor(DARK).text(r.unit ?? "pza", 380, y + 8, { width: 50 });
      doc.font("Helvetica-Bold").text(String(r.quantity), 430, y + 8, { width: 70, align: "right" });
      doc.font("Helvetica").fillColor(MUTED).text(String(r.minThreshold), 500, y + 8, { width: 55, align: "right" });

      const status = r.status === "empty" ? "SIN STOCK" : r.status === "low" ? "BAJO" : "OK";
      const color = r.status === "empty" ? "b91c1c" : r.status === "low" ? "b45309" : "16a34a";
      const bw = 58;
      doc.rect(W - bw + 10, y + 6, bw - 10, 12).fill(color);
      doc.fillColor("white").font("Helvetica-Bold").fontSize(7.5).text(status, W - bw + 13, y + 9, {
        width: bw - 16,
        align: "center",
      });
      doc.font("Helvetica").fontSize(8.5);

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