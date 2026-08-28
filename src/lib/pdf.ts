import PDFDocument from "pdfkit";
import path from "path";

// FASE 8.7 — Exportación de inventario en PDF profesional (pdfkit, server-side).
const FONT = path.join(process.cwd(), "public", "fonts", "Roboto-Regular.ttf");

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

/** Limpia texto para pdfkit: reemplaza chars que Helvetica no soporta. */
function safeText(v: unknown): string {
  if (v == null) return "—";
  return String(v)
    .replace(/[\u2018\u2019\u201C\u201D]/g, "\"")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u00A0]/g, " ")
    .trim();
}

export function buildInventoryPdf({
  organizationName,
  locationName,
  generatedAt,
  rows,
}: PdfInventoryConfig): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
    doc.registerFont("Roboto", FONT);

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - 80;

    // Header
    doc.rect(0, 0, doc.page.width, 64).fill(INDIGO);
    doc.font("Roboto").fontSize(16).fillColor("white");
    doc.text(safeText(organizationName || "Reporte de inventario"), 40, 16, { width: W - 120, lineBreak: false });
    doc.fontSize(10);
    doc.text("Reporte de inventario", 40, 38, { width: W - 120, lineBreak: false });

    // Metadata
    let y = 78;
    doc.font("Roboto").fontSize(8).fillColor(MUTED);
    doc.text("Sucursal / CEDIS:", 40, y, { width: 110 });
    doc.fillColor(DARK).text(safeText(locationName), 120, y, { width: W - 80 });
    y += 18;
    doc.font("Roboto").fontSize(8).fillColor(MUTED);
    doc.text("Generado:", 40, y, { width: 110 });
    doc.fillColor(DARK).text(generatedAt.toLocaleDateString("es-MX") + " " + generatedAt.toLocaleTimeString("es-MX"), 120, y, { width: W - 80 });
    y += 18;

    // Summary
    const low = rows.filter((r) => r.status === "low").length;
    const empty = rows.filter((r) => r.status === "empty").length;
    doc.font("Roboto").fontSize(9).fillColor(DARK);
    doc.text(`Total de productos: ${rows.length}   ·   Stock bajo: ${low}   ·   Sin stock: ${empty}`, 40, y, { width: W });
    y += 20;

    // Table header
    const h = 24;
    const drawHeader = () => {
      doc.rect(40, y, W, h).fill(SLATE_HEAD);
      doc.font("Roboto").fontSize(8.5).fillColor("white");
      doc.text("PRODUCTO", 50, y + 8, { width: 190, lineBreak: false });
      doc.text("VARIANTE / SKU", 240, y + 8, { width: 140, lineBreak: false });
      doc.text("UNIDAD", 380, y + 8, { width: 50, lineBreak: false });
      doc.text("EXISTENCIA", 430, y + 8, { width: 70, align: "right", lineBreak: false });
      doc.text("MINIMO", 500, y + 8, { width: 55, align: "right", lineBreak: false });
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

      doc.font("Roboto").fontSize(8.5).fillColor(DARK);
      doc.text(safeText(clamp(r.productName, 40)), 50, y + 8, { width: 190, lineBreak: false });
      doc.fillColor(MUTED);
      const variant = r.variantName
        ? `${r.variantName}${r.sku ? ` · ${r.sku}` : ""}`
        : r.sku ?? "—";
      doc.text(safeText(clamp(variant, 34)), 240, y + 8, { width: 140, lineBreak: false });
      doc.fillColor(DARK).text(safeText(r.unit ?? "pza"), 380, y + 8, { width: 50, lineBreak: false });
      doc.text(safeText(String(r.quantity)), 430, y + 8, { width: 70, align: "right", lineBreak: false });
      doc.fillColor(MUTED).text(safeText(String(r.minThreshold)), 500, y + 8, { width: 55, align: "right", lineBreak: false });

      const status = r.status === "empty" ? "SIN STOCK" : r.status === "low" ? "BAJO" : "OK";
      const color = r.status === "empty" ? "b91c1c" : r.status === "low" ? "b45309" : "16a34a";
      const bw = 58;
      doc.save();
      doc.rect(W - bw + 10, y + 6, bw - 10, 12).fill(color);
      doc.restore();
      doc.fillColor("white").font("Roboto").fontSize(7.5).text(status, W - bw + 13, y + 9, {
        width: bw - 16,
        align: "center",
        lineBreak: false,
      });
      doc.fillColor(DARK).font("Roboto").fontSize(8.5);

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
    const doc = new PDFDocument({ size: "A4", margin: 40, bufferPages: true });
    doc.registerFont("Roboto", FONT);
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - 80;

    // Header
    doc.rect(0, 0, doc.page.width, 64).fill(INDIGO);
    doc.font("Roboto").fontSize(16).fillColor("white");
    doc.text(safeText(config.organizationName || "Reporte de inventario"), 40, 16, { width: W - 120, lineBreak: false });
    doc.fontSize(10);
    doc.text(`Reporte de revision fisica #${config.revisionNumber}`, 40, 38, { width: W - 120, lineBreak: false });

    // Metadata
    let y = 78;
    const meta = (label: string, value: string) => {
      doc.font("Roboto").fontSize(8).fillColor(MUTED).text(label, 40, y, { width: 110 });
      doc.fillColor(DARK).text(safeText(value), 120, y, { width: W - 80 });
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
      doc.font("Roboto").fontSize(8.5).fillColor(DARK).text(safeText(config.notes), 40, y, { width: W });
      y += 28;
    }

    // Summary
    const counted = config.items.filter((i) => i.countedQuantity != null).length;
    const withDiff = config.items.filter((i) => i.difference != null && i.difference !== 0).length;
    doc.font("Roboto").fontSize(9).fillColor(DARK);
    doc.text(`Total: ${config.items.length}   ·   Contados: ${counted}   ·   Con diferencia: ${withDiff}`, 40, y, { width: W });
    y += 22;

    // Table
    const h = 24;
    const headerRow = () => {
      doc.rect(40, y, W, h).fill(SLATE_HEAD);
      doc.font("Roboto").fontSize(8.5).fillColor("white");
      doc.text("PRODUCTO", 50, y + 8, { width: 200, lineBreak: false });
      doc.text("VARIANTE / SKU", 250, y + 8, { width: 140, lineBreak: false });
      doc.text("ESPERADO", 390, y + 8, { width: 60, align: "right", lineBreak: false });
      doc.text("CONTADO", 450, y + 8, { width: 60, align: "right", lineBreak: false });
      doc.text("DIF.", 510, y + 8, { width: 50, align: "right", lineBreak: false });
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

      doc.font("Roboto").fontSize(8.5).fillColor(DARK);
      doc.text(safeText(clamp(r.productName, 44)), 50, y + 8, { width: 200, lineBreak: false });
      doc.fillColor(MUTED);
      const variant = r.variantName
        ? `${r.variantName}${r.sku ? ` · ${r.sku}` : ""}`
        : r.sku ?? "—";
      doc.text(safeText(clamp(variant, 30)), 250, y + 8, { width: 140, lineBreak: false });
      doc.fillColor(DARK).text(safeText(String(r.expectedQuantity)), 390, y + 8, { width: 60, align: "right", lineBreak: false });
      doc.fillColor(r.countedQuantity != null ? DARK : MUTED);
      doc.text(safeText(r.countedQuantity != null ? String(r.countedQuantity) : "—"), 450, y + 8, {
        width: 60,
        align: "right",
        lineBreak: false,
      });

      const diff = r.difference;
      if (diff == null) {
        doc.fillColor(MUTED).text("—", 510, y + 8, { width: 50, align: "right", lineBreak: false });
      } else if (diff === 0) {
        doc.fillColor("16a34a").text("0", 510, y + 8, { width: 50, align: "right", lineBreak: false });
      } else {
        doc.fillColor(diff > 0 ? "16a34a" : "b91c1c").text(`${diff > 0 ? "+" : ""}${diff}`, 510, y + 8, {
          width: 50,
          align: "right",
          lineBreak: false,
        });
      }
      y += h;
    }

    // Footer on all pages
    const pages = doc.bufferedPageRange();
    for (let p = pages.start; p < pages.start + pages.count; p++) {
      doc.switchToPage(p);
      doc.font("Roboto").fontSize(8).fillColor(MUTED);
      doc.text(
        `Generado por Multi-POS · ${config.generatedAt.toLocaleDateString("es-MX")} ${config.generatedAt.toLocaleTimeString("es-MX")}`,
        40, doc.page.height - 46, { width: W / 2 }
      );
      doc.text(`Pagina ${pages.start + pages.count}`, 40 + W / 2, doc.page.height - 46, {
        width: W / 2,
        align: "right",
      });
    }

    doc.end();
  });
}
