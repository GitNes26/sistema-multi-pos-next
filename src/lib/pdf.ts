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
const SLATE_ROW = "f1f5f9";
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

    // Header
    doc.rect(0, 0, doc.page.width, 64).fill(INDIGO);
    doc.font("Helvetica-Bold").fontSize(16).fillColor("white");
    doc.text(organizationName || "Reporte de inventario", 40, 16, { width: W - 120 });
    doc.font("Helvetica").fontSize(10).fillColor("white");
    doc.text("Reporte de inventario", 40, 38, { width: W - 120 });

    // Metadata
    let y = 78;
    doc.font("Helvetica").fontSize(8).fillColor(MUTED);
    doc.text("Sucursal / CEDIS:", 40, y, { width: 110 });
    doc.fillColor(DARK).text(locationName, 120, y, { width: W - 80 });
    y += 18;
    doc.font("Helvetica").fontSize(8).fillColor(MUTED);
    doc.text("Generado:", 40, y, { width: 110 });
    doc.fillColor(DARK).text(generatedAt.toLocaleString("es-MX"), 120, y, { width: W - 80 });
    y += 18;

    // Summary
    const low = rows.filter((r) => r.status === "low").length;
    const empty = rows.filter((r) => r.status === "empty").length;
    doc.font("Helvetica").fontSize(9).fillColor(DARK);
    doc.text(`Total de productos: ${rows.length}   ·   Stock bajo: ${low}   ·   Sin stock: ${empty}`, 40, y, { width: W });
    y += 20;

    // Table header
    const h = 24;
    const drawHeader = () => {
      doc.rect(40, y, W, h).fill(SLATE_HEAD);
      doc.fillColor("white").font("Helvetica-Bold").fontSize(8.5);
      doc.text("PRODUCTO", 50, y + 8, { width: 190 });
      doc.text("VARIANTE / SKU", 240, y + 8, { width: 140 });
      doc.text("UNIDAD", 380, y + 8, { width: 50 });
      doc.text("EXISTENCIA", 430, y + 8, { width: 70, align: "right" });
      doc.text("MÍNIMO", 500, y + 8, { width: 55, align: "right" });
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

      doc.font("Helvetica").fontSize(8.5).fillColor(DARK);
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
      doc.save();
      doc.rect(W - bw + 10, y + 6, bw - 10, 12).fill(color);
      doc.restore();
      doc.fillColor("white").font("Helvetica-Bold").fontSize(7.5).text(status, W - bw + 13, y + 9, {
        width: bw - 16,
        align: "center",
      });
      doc.font("Helvetica").fontSize(8.5);

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

export interface PdfRevisionItem {
  productName: string;
  variantName: string | null;
  sku: string | null;
  unit: string | null;
  expectedQuantity: number;
  countedQuantity: number | null;
  difference: number | null;
}

export interface PdfRevisionConfig {
  organizationName: string;
  locationName: string;
  revisionNumber: number;
  status: string;
  notes: string | null;
  performedBy: string | null;
  startedAt: string | null;
  completedAt: string | null;
  generatedAt: Date;
  items: PdfRevisionItem[];
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  in_progress: "En conteo",
  completed: "Completada",
  cancelled: "Cancelada",
};

export function buildRevisionPdf(config: PdfRevisionConfig): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - 80;
    const footer = () => {
      const pages = doc.bufferedPageRange();
      doc.fillColor(MUTED).font("Helvetica").fontSize(8);
      doc.text(
        `Generado por el sistema Multi-POS · ${config.generatedAt.toLocaleString("es-MX")}`,
        40,
        doc.page.height - 46,
        { width: W / 2 }
      );
      doc.text(`Página ${pages.start + pages.count}`, 40 + W / 2, doc.page.height - 46, {
        width: W / 2,
        align: "right",
      });
    };

    // Header
    doc.rect(0, 0, doc.page.width, 64).fill(INDIGO);
    doc.font("Helvetica-Bold").fontSize(16).fillColor("white");
    doc.text(config.organizationName || "Reporte de inventario", 40, 16, { width: W - 120 });
    doc.font("Helvetica").fontSize(10).fillColor("white");
    doc.text(`Reporte de revisión física #${config.revisionNumber}`, 40, 38, { width: W - 120 });

    // Metadata
    let y = 78;
    const meta = (label: string, value: string) => {
      doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(label, 40, y, { width: 110 });
      doc.fillColor(DARK).text(value, 120, y, { width: W - 80 });
      y += 18;
    };

    meta("Sucursal / CEDIS:", config.locationName);
    meta("Estado:", STATUS_LABELS[config.status] ?? config.status);
    meta("Responsable:", config.performedBy ?? "—");
    meta("Inicio:", config.startedAt ? new Date(config.startedAt).toLocaleString("es-MX") : "—");
    if (config.completedAt) {
      meta("Finalizada:", new Date(config.completedAt).toLocaleString("es-MX"));
    }

    if (config.notes) {
      doc.font("Helvetica-Bold").fontSize(8).fillColor(DARK).text("NOTAS:", 40, y, { width: W });
      y += 12;
      doc.font("Helvetica").fontSize(8.5).fillColor(DARK).text(config.notes, 40, y, { width: W });
      y += 28;
    }

    // Summary
    const counted = config.items.filter((i) => i.countedQuantity != null).length;
    const withDiff = config.items.filter((i) => i.difference != null && i.difference !== 0).length;
    doc.font("Helvetica").fontSize(9).fillColor(DARK);
    doc.text(`Total: ${config.items.length}   ·   Contados: ${counted}   ·   Con diferencia: ${withDiff}`, 40, y, { width: W });
    y += 22;

    // Table
    const h = 24;
    const headerRow = () => {
      doc.rect(40, y, W, h).fill(SLATE_HEAD);
      doc.fillColor("white").font("Helvetica-Bold").fontSize(8.5);
      doc.text("PRODUCTO", 50, y + 8, { width: 200 });
      doc.text("VARIANTE / SKU", 250, y + 8, { width: 140 });
      doc.text("ESPERADO", 390, y + 8, { width: 60, align: "right" });
      doc.text("CONTADO", 450, y + 8, { width: 60, align: "right" });
      doc.text("DIF.", 510, y + 8, { width: 50, align: "right" });
      y += h;
    };
    headerRow();

    for (let i = 0; i < config.items.length; i++) {
      const r = config.items[i];
      if (y + h > doc.page.height - 56) {
        doc.addPage();
        y = 40;
        headerRow();
      }
      if (i % 2 === 1) {
        doc.save();
        doc.rect(40, y, W, h).fill(SLATE_ROW);
        doc.restore();
      }

      doc.font("Helvetica").fontSize(8.5).fillColor(DARK);
      doc.text(clamp(r.productName, 44), 50, y + 8, { width: 200 });
      doc.fillColor(MUTED);
      const variant = r.variantName
        ? `${r.variantName}${r.sku ? ` · ${r.sku}` : ""}`
        : r.sku ?? "—";
      doc.text(clamp(variant, 30), 250, y + 8, { width: 140 });
      doc.fillColor(DARK).text(String(r.expectedQuantity), 390, y + 8, { width: 60, align: "right" });
      doc.fillColor(r.countedQuantity != null ? DARK : MUTED);
      doc.text(r.countedQuantity != null ? String(r.countedQuantity) : "—", 450, y + 8, {
        width: 60,
        align: "right",
      });

      const diff = r.difference;
      if (diff == null) {
        doc.fillColor(MUTED).text("—", 510, y + 8, { width: 50, align: "right" });
      } else if (diff === 0) {
        doc.fillColor("16a34a").text("0", 510, y + 8, { width: 50, align: "right" });
      } else {
        doc.font("Helvetica-Bold");
        doc.fillColor(diff > 0 ? "16a34a" : "b91c1c").text(`${diff > 0 ? "+" : ""}${diff}`, 510, y + 8, {
          width: 50,
          align: "right",
        });
        doc.font("Helvetica");
      }
      y += h;
    }

    footer();
    doc.end();
  });
}
