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

export interface ExecutiveReportSection {
  title: string;
  description: string;
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: Record<string, string | number | null>[];
  metrics: { label: string; value: string }[];
  analysis: string;
  chart?: { label: string; value: number }[];
}

export interface ExecutivePdfConfig {
  organizationName: string;
  legalName?: string | null;
  taxId?: string | null;
  logo?: Buffer | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  locationName?: string | null;
  period: string;
  filters: string[];
  businessMode?: string | null;
  appearance?: {
    primaryHue?: number | null;
    accentHue?: number | null;
    theme?: string | null;
    fontFamily?: string | null;
    fontScale?: number | null;
    density?: string | null;
    borderRadius?: number | null;
  } | null;
  sections: ExecutiveReportSection[];
}
export type ExecutivePdfBranding = Omit<ExecutivePdfConfig, "period" | "filters" | "sections">;

export function buildExecutiveReportPdf(config: ExecutivePdfConfig): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const margin = 28;
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin, bufferPages: true, info: { Title: `Informe ejecutivo - ${config.organizationName}`, Author: config.organizationName } });
    registerFonts(doc);
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const width = doc.page.width - margin * 2;
    const appearance = config.appearance ?? {};
    const hslToHex = (h: number, s: number, l: number) => {
      const hue = ((h % 360) + 360) % 360;
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
      const m = l - c / 2;
      const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
      return `#${[r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("")}`;
    };
    const primaryHue = Number(appearance.primaryHue ?? 210);
    const accentHue = Number(appearance.accentHue ?? 150);
    const primary = primaryHue === 360 ? "#5f6673" : hslToHex(primaryHue, 0.58, 0.38);
    const accent = accentHue === 360 ? "#eef0f3" : hslToHex(accentHue, 0.42, 0.93);
    const ink = "#172033";
    const muted = "#667085";
    const line = "#d8dee9";
    const soft = "#f6f8fb";
    const scale = Math.max(0.9, Math.min(1.08, Number(appearance.fontScale ?? 1)));
    const rowH = appearance.density === "compact" ? 14 : appearance.density === "spacious" ? 17 : 15.5;
    const radius = Math.max(2, Math.min(10, Number(appearance.borderRadius ?? 0.75) * 7));
    const generatedAt = new Date().toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });

    const drawBrand = (continuation = false) => {
      doc.rect(0, 0, doc.page.width, 5).fill(primary);
      let textX = margin;
      if (config.logo) {
        try { doc.image(config.logo, margin, 14, { fit: [62, 30], valign: "center" }); textX = 100; } catch { /* conserva identidad textual */ }
      }
      doc.font("Helvetica-Bold").fontSize(10 * scale).fillColor(ink).text(config.organizationName, textX, 16, { width: 300, lineBreak: false });
      const identity = [config.legalName, config.taxId ? `RFC ${config.taxId}` : null].filter(Boolean).join(" · ");
      doc.font("Roboto").fontSize(6.6 * scale).fillColor(muted).text(identity || "Reporte empresarial", textX, 31, { width: 390, lineBreak: false });
      const contact = [config.locationName, config.phone, config.email].filter(Boolean).join(" · ");
      doc.font("Roboto").fontSize(6.4 * scale).fillColor(muted).text(contact, 480, 17, { width: doc.page.width - margin - 480, align: "right", lineBreak: false });
      if (!continuation) doc.text(clamp(config.address || "", 76), 480, 30, { width: doc.page.width - margin - 480, align: "right", lineBreak: false });
      doc.moveTo(margin, 51).lineTo(doc.page.width - margin, 51).strokeColor(line).lineWidth(0.6).stroke();
    };

    const drawSectionHeading = (section: ExecutiveReportSection, continuation = false) => {
      drawBrand(continuation);
      doc.font("Helvetica-Bold").fontSize((continuation ? 12 : 17) * scale).fillColor(ink).text(section.title, margin, 62, { width: 490, lineBreak: false });
      doc.font("Roboto").fontSize(7 * scale).fillColor(muted).text(continuation ? "Continuación" : section.description, margin, continuation ? 80 : 84, { width: 500, lineBreak: false });
      const meta = [config.period, ...(config.filters.length ? config.filters : ["Sin filtros adicionales"])].join(" · ");
      doc.font("Roboto").fontSize(6.7 * scale).fillColor(muted).text(meta, 548, 65, { width: doc.page.width - margin - 548, align: "right", lineBreak: false });
      doc.text(generatedAt, 548, 80, { width: doc.page.width - margin - 548, align: "right", lineBreak: false });
    };

    const drawTableHeader = (columns: ExecutiveReportSection["columns"], y: number) => {
      const colW = width / Math.max(1, columns.length);
      doc.roundedRect(margin, y, width, rowH, Math.min(radius, 4)).fill(primary);
      columns.forEach((column, index) => doc.font("Helvetica-Bold").fontSize(6.2 * scale).fillColor(WHITE).text(column.label.toUpperCase(), margin + 5 + index * colW, y + 4.5, { width: colW - 10, align: column.align ?? "left", lineBreak: false }));
      return colW;
    };

    config.sections.forEach((section, sectionIndex) => {
      if (sectionIndex > 0) doc.addPage();
      drawSectionHeading(section);
      let y = 105;
      const metrics = section.metrics.slice(0, 4);
      const metricW = (width - Math.max(0, metrics.length - 1) * 7) / Math.max(1, metrics.length);
      metrics.forEach((metric, index) => {
        const x = margin + index * (metricW + 7);
        doc.roundedRect(x, y, metricW, 34, radius).fill(index === 0 ? accent : soft);
        doc.font("Roboto").fontSize(6.2 * scale).fillColor(muted).text(metric.label.toUpperCase(), x + 9, y + 6, { width: metricW - 18, lineBreak: false });
        doc.font("Helvetica-Bold").fontSize(11.5 * scale).fillColor(ink).text(metric.value, x + 9, y + 17, { width: metricW - 18, lineBreak: false });
      });
      y += 43;
      const chart = section.chart?.slice(0, 4) ?? [];
      const analysisW = chart.length ? 365 : width;
      doc.font("Helvetica-Bold").fontSize(7 * scale).fillColor(primary).text("LECTURA EJECUTIVA", margin, y);
      doc.font("Roboto").fontSize(7.1 * scale).fillColor(ink).text(section.analysis, margin, y + 12, { width: analysisW, height: 39, ellipsis: true, lineGap: 1 });
      if (chart.length) {
        const chartX = margin + 395;
        const max = Math.max(...chart.map((item) => item.value), 1);
        chart.forEach((item, index) => {
          const cy = y + index * 13;
          doc.font("Roboto").fontSize(5.8 * scale).fillColor(muted).text(clamp(item.label, 19), chartX, cy, { width: 93, lineBreak: false });
          doc.roundedRect(chartX + 96, cy + 1, Math.max(2, item.value / max * 205), 6, 3).fill(primary);
          doc.font("Roboto").fontSize(5.8 * scale).fillColor(ink).text(item.value.toLocaleString("es-MX"), chartX + 305, cy, { width: 52, align: "right", lineBreak: false });
        });
      }
      y += 55;
      const columns = section.columns.slice(0, 8);
      let colW = drawTableHeader(columns, y);
      y += rowH;
      for (let index = 0; index < section.rows.length; index++) {
        if (y + rowH > doc.page.height - 27) {
          doc.addPage();
          drawSectionHeading(section, true);
          y = 103;
          colW = drawTableHeader(columns, y);
          y += rowH;
        }
        if (index % 2 === 1) doc.rect(margin, y, width, rowH).fill(soft);
        columns.forEach((column, columnIndex) => doc.font("Roboto").fontSize(6.35 * scale).fillColor(ink).text(clamp(safe(section.rows[index][column.key]), Math.max(8, Math.floor(colW / 4.6))), margin + 5 + columnIndex * colW, y + 4.5, { width: colW - 10, align: column.align ?? "left", lineBreak: false }));
        y += rowH;
      }
      if (!section.rows.length) doc.font("Roboto").fontSize(8 * scale).fillColor(muted).text("No hay datos para este reporte con los filtros seleccionados.", margin, y + 14, { width, align: "center" });
    });
    const pages = doc.bufferedPageRange();
    for (let p = pages.start; p < pages.start + pages.count; p++) {
      doc.switchToPage(p); doc.page.margins.bottom = 0;
      doc.font("Roboto").fontSize(6.2 * scale).fillColor(muted).text(`CONFIDENCIAL · ${config.organizationName} · ${config.businessMode || "Multi-POS"}`, margin, doc.page.height - 18, { width: width - 90, lineBreak: false });
      doc.text(`${p - pages.start + 1} / ${pages.count}`, doc.page.width - 80, doc.page.height - 18, { width: 52, align: "right", lineBreak: false });
    }
    doc.end();
  });
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
  returnsTotal = 0,
  branding?: ExecutivePdfBranding
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
  return buildExecutiveReportPdf({ organizationName: orgName, ...branding, period: "Periodo seleccionado", filters: ["Filtros aplicados en el reporte"], sections: [{ title: "Ventas", description: "Detalle de ventas y resultado neto del periodo.", metrics: summary, analysis: returnsTotal > 0 ? `La venta neta del periodo es ${money(net)} después de devoluciones por ${money(returnsTotal)}.` : `Se registraron ${rows.length} ventas por un total de ${money(total)}.`, columns: [{key:"folio",label:"Folio"},{key:"date",label:"Fecha"},{key:"locationName",label:"Sucursal"},{key:"customerName",label:"Cliente"},{key:"total",label:"Total",align:"right"}], rows: rows.map(row=>({...row,date:new Date(row.date).toLocaleDateString("es-MX"),customerName:row.customerName??"—",total:money(row.total)})) }] });
}

export function buildCashReportPdf(
  orgName: string,
  rows: { registerName: string | null; locationName: string; employeeName: string | null; openedAt: string | null; closedAt: string | null; status: string; salesCount: number; totalSales: number; expectedCash: number; closingCash: number | null; difference: number | null }[],
  branding?: ExecutivePdfBranding
): Promise<Buffer> {
  const totalSales = rows.reduce((a, r) => a + r.totalSales, 0);
  return buildExecutiveReportPdf({ organizationName:orgName,...branding,period:"Periodo seleccionado",filters:["Filtros aplicados en el reporte"],sections:[{title:"Corte de caja",description:"Sesiones, ventas y diferencias de caja.",metrics:[{label:"Sesiones",value:String(rows.length)},{label:"Ventas",value:money(totalSales)}],analysis:`Las ${rows.length} sesiones acumulan ventas por ${money(totalSales)}.`,columns:[{key:"registerName",label:"Caja"},{key:"locationName",label:"Sucursal"},{key:"employeeName",label:"Cajero"},{key:"openedAt",label:"Apertura"},{key:"totalSales",label:"Ventas",align:"right"},{key:"expectedCash",label:"Esperado",align:"right"},{key:"difference",label:"Diferencia",align:"right"}],rows:rows.map(row=>({...row,registerName:row.registerName??"—",employeeName:row.employeeName??"—",openedAt:row.openedAt?new Date(row.openedAt).toLocaleDateString("es-MX"):"—",totalSales:money(row.totalSales),expectedCash:money(row.expectedCash),difference:row.difference==null?"—":money(row.difference)}))}]});
}

export function buildOrdersReportPdf(
  orgName: string,
  rows: { orderNumber: number; status: string; deliveryMethod: string; customerName: string | null; locationName: string | null; total: number; createdAt: string }[],
  branding?: ExecutivePdfBranding
): Promise<Buffer> {
  const total=rows.reduce((sum,row)=>sum+row.total,0);return buildExecutiveReportPdf({organizationName:orgName,...branding,period:"Periodo seleccionado",filters:["Filtros aplicados en el reporte"],sections:[{title:"Pedidos",description:"Pedidos, modalidad de entrega y estado operativo.",metrics:[{label:"Pedidos",value:String(rows.length)},{label:"Importe",value:money(total)}],analysis:`Los pedidos seleccionados representan ${money(total)} en ventas.`,columns:[{key:"orderNumber",label:"Pedido"},{key:"createdAt",label:"Fecha"},{key:"customerName",label:"Cliente"},{key:"deliveryMethod",label:"Entrega"},{key:"status",label:"Estado"},{key:"total",label:"Total",align:"right"}],rows:rows.map(row=>({...row,orderNumber:`#${row.orderNumber}`,createdAt:new Date(row.createdAt).toLocaleDateString("es-MX"),customerName:row.customerName??"—",deliveryMethod:row.deliveryMethod==="delivery"?"Domicilio":"Sucursal",total:money(row.total)}))}]});
}

export function buildCustomersReportPdf(
  orgName: string,
  rows: { fullName: string; customerCode: string | null; phone: string | null; points: number; salesCount: number; totalSpent: number }[],
  branding?: ExecutivePdfBranding
): Promise<Buffer> {
  const total=rows.reduce((sum,row)=>sum+row.totalSpent,0);return buildExecutiveReportPdf({organizationName:orgName,...branding,period:"Acumulado",filters:["Clientes incluidos en el reporte"],sections:[{title:"Clientes",description:"Actividad comercial y lealtad de clientes.",metrics:[{label:"Clientes",value:String(rows.length)},{label:"Venta acumulada",value:money(total)}],analysis:`Los clientes incluidos acumulan compras por ${money(total)}.`,columns:[{key:"fullName",label:"Cliente"},{key:"customerCode",label:"Núm. cliente"},{key:"phone",label:"Teléfono"},{key:"salesCount",label:"Compras",align:"right"},{key:"points",label:"Puntos",align:"right"},{key:"totalSpent",label:"Total",align:"right"}],rows:rows.map(row=>({...row,customerCode:row.customerCode??"—",phone:row.phone??"—",totalSpent:money(row.totalSpent)}))}]});
}
