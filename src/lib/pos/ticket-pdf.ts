import PDFDocument from "pdfkit";
import { prisma } from "@/lib/db";
import type { $Enums } from "@prisma/client";
import bwipjs from "bwip-js/node";
import { buildTicketCode } from "@/lib/sales/ticket-code";
import { getReturnDetail } from "@/lib/returns/server";

// Ticket térmico en PDF (58/80 mm). Un solo diseño para ventas, ventas por
// pedido y devoluciones: encabezado de la empresa, partidas, totales, pagos,
// observaciones y código de barras. Las reimpresiones llevan marca de agua.

const MXN = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  wallet: "Wallet",
  other: "Otro",
  transfer: "Transferencia",
  points: "Puntos",
  credit: "Crédito",
};

export type TicketPaperWidth = 58 | 80;

export interface TicketModel {
  paperWidth: TicketPaperWidth;
  company: { name: string; logoUrl: string | null; address: string | null; phone: string | null; footer: string | null };
  locationName: string;
  /** Título bajo el nombre (p. ej. «TICKET DE DEVOLUCIÓN»). */
  title?: string;
  folio: string;
  date: Date;
  register?: string | null;
  cashier?: string | null;
  customer?: { name: string; code?: string | null } | null;
  /** Líneas de contexto bajo el encabezado (venta original, tipo, estado…). */
  meta?: string[];
  items: { title: string; details: string[]; qty: string; amount: string; note?: string }[];
  itemsHeading?: string;
  totals: { label: string; amount: string; strong?: boolean; big?: boolean }[];
  payments: { label: string; amount: string }[];
  extras?: string[];
  /** Observaciones al pie (p. ej. «Venta devuelta: DEV-3»). */
  observations?: string[];
  barcodeText: string;
  barcodeCaption: string;
  thanks?: string;
  reprint?: boolean;
}

async function fetchLogo(url: string | null): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const abs = url.startsWith("http") ? url : `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}${url}`;
    const res = await fetch(abs);
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

/** Dibuja el ticket; devuelve la Y final para dimensionar la página. */
function draw(doc: PDFKit.PDFDocument, m: TicketModel, logo: Buffer | null, barcode: Buffer): number {
  const pageWidth = m.paperWidth * 2.83465;
  const margin = m.paperWidth === 58 ? 9 : 12;
  const contentWidth = pageWidth - margin * 2;
  const amountWidth = m.paperWidth === 58 ? 54 : 74;
  const small = m.paperWidth === 58 ? 7 : 8;

  const rule = () => {
    doc.moveTo(margin, doc.y + 4).lineTo(pageWidth - margin, doc.y + 4).dash(2, { space: 2 }).stroke();
    doc.undash();
    doc.moveDown(0.8);
  };
  const row = (l: string, r: string) => {
    const y = doc.y;
    doc.text(l, margin, y, { width: contentWidth - amountWidth - 4, lineBreak: false, ellipsis: true });
    doc.text(r, pageWidth - margin - amountWidth, y, { align: "right", width: amountWidth, lineBreak: false });
    doc.y = y + doc.currentLineHeight() + 2;
  };
  const center = (t: string) => doc.text(t, margin, doc.y, { align: "center", width: contentWidth });

  doc.x = margin;
  doc.y = margin;
  if (m.reprint) {
    doc.font("Courier-Bold").fontSize(small + 1);
    center("*** REIMPRESIÓN ***");
    doc.moveDown(0.4);
  }
  if (logo) {
    try {
      const w = 40;
      doc.image(logo, (pageWidth - w) / 2, doc.y, { width: w });
      doc.moveDown(3.2);
    } catch {
      /* logo inválido: se omite */
    }
  }
  doc.font("Courier-Bold").fontSize(m.paperWidth === 58 ? 10 : 12);
  center(m.company.name);
  doc.fontSize(8);
  center(m.locationName);
  doc.font("Courier").fontSize(7);
  if (m.company.address) center(m.company.address);
  if (m.company.phone) center(`Tel: ${m.company.phone}`);
  if (m.title) {
    doc.moveDown(0.3);
    doc.font("Courier-Bold").fontSize(small + 1);
    center(m.title);
    doc.font("Courier").fontSize(7);
  }
  center(m.folio);
  center(m.date.toLocaleString("es-MX"));
  if (m.register) center(`Caja: ${m.register}`);
  if (m.cashier) center(`Atendió: ${m.cashier}`);
  for (const line of m.meta ?? []) center(line);
  rule();

  if (m.customer) {
    doc.font("Courier-Bold").fontSize(small).text("Cliente:", margin);
    doc.font("Courier").text(`${m.customer.name}${m.customer.code ? ` · Nº ${m.customer.code}` : ""}`, margin);
    doc.moveDown(0.5);
  }

  if (m.itemsHeading) {
    doc.font("Courier-Bold").fontSize(small).text(m.itemsHeading, margin);
    doc.moveDown(0.2);
  }
  for (const i of m.items) {
    doc.font("Courier-Bold").fontSize(small).text(i.title, margin, doc.y, { width: contentWidth });
    doc.font("Courier").fontSize(7);
    for (const d of i.details) doc.text(d, margin + 4, doc.y, { width: contentWidth - 4 });
    doc.fontSize(small);
    row(i.qty, i.amount);
    if (i.note) doc.font("Courier-Oblique").fontSize(6).text(i.note, margin + 4, doc.y, { width: contentWidth - 4 });
    doc.font("Courier");
  }
  rule();

  doc.fontSize(small);
  for (const t of m.totals) {
    if (t.big) {
      doc.moveDown(0.2);
      doc.font("Courier-Bold").fontSize(11);
      row(t.label, t.amount);
      doc.font("Courier").fontSize(small);
    } else if (t.strong) {
      doc.font("Courier-Bold");
      row(t.label, t.amount);
      doc.font("Courier");
    } else row(t.label, t.amount);
  }

  if (m.payments.length) {
    rule();
    doc.fontSize(small);
    for (const p of m.payments) row(p.label, p.amount);
  }
  if (m.extras?.length) {
    doc.moveDown(0.3);
    doc.fontSize(small);
    for (const e of m.extras) doc.text(e, margin, doc.y, { width: contentWidth });
  }
  if (m.observations?.length) {
    doc.moveDown(0.5);
    doc.font("Courier-Bold").fontSize(7).text("OBSERVACIONES", margin, doc.y, { width: contentWidth });
    doc.font("Courier").fontSize(7);
    for (const o of m.observations) doc.text(`• ${o}`, margin, doc.y, { width: contentWidth });
  }

  doc.moveDown(1);
  if (m.company.footer) {
    doc.font("Courier").fontSize(7);
    center(m.company.footer);
    doc.moveDown(0.5);
  }
  doc.font("Courier-Bold").fontSize(8);
  center(m.thanks ?? "¡Gracias por su compra!");
  doc.moveDown(0.7);
  doc.image(barcode, margin + 4, doc.y, { fit: [contentWidth - 8, 34], align: "center" });
  doc.moveDown(3.4);
  doc.font("Courier").fontSize(6);
  center(m.barcodeCaption);
  return doc.y + margin;
}

/** Marca de agua diagonal repetida a lo largo del ticket. */
function watermark(doc: PDFKit.PDFDocument, width: number, height: number) {
  for (let y = 90; y < height; y += 220) {
    doc.save();
    doc.rotate(-28, { origin: [width / 2, y] });
    doc.fillColor("#000000").opacity(0.1).font("Helvetica-Bold").fontSize(width > 180 ? 26 : 20);
    doc.text("REIMPRESIÓN", 0, y - 12, { width, align: "center", lineBreak: false });
    doc.restore();
  }
  doc.opacity(1).fillColor("#000000");
}

export async function renderTicketPdf(m: TicketModel): Promise<Buffer> {
  const pageWidth = m.paperWidth * 2.83465;
  const margin = m.paperWidth === 58 ? 9 : 12;
  const [logo, barcode] = await Promise.all([
    fetchLogo(m.company.logoUrl),
    bwipjs.toBuffer({ bcid: "code128", text: m.barcodeText, height: 10, scale: 2, includetext: false, padding: 0 }),
  ]);

  // Pasada 1: mide la altura real; pasada 2: página del tamaño exacto.
  const measure = new PDFDocument({ size: [pageWidth, 6000], margin });
  measure.on("data", () => undefined);
  const height = Math.ceil(draw(measure, m, logo, barcode));
  measure.end();

  const doc = new PDFDocument({ size: [pageWidth, Math.max(height, 200)], margin, font: "Courier" });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  draw(doc, m, logo, barcode);
  if (m.reprint) watermark(doc, pageWidth, Math.max(height, 200));
  doc.end();
  return done;
}

async function companyOf(organizationId: string) {
  const [company, organization] = await Promise.all([
    prisma.companyProfile.findUnique({
      where: { organizationId },
      select: { tradeName: true, legalName: true, logoUrl: true, address: true, city: true, phone: true, ticketFooter: true },
    }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true, pointValue: true } }),
  ]);
  return {
    pointValue: Number(organization?.pointValue ?? 0),
    company: {
      name: company?.tradeName ?? company?.legalName ?? organization?.name ?? "Empresa",
      logoUrl: company?.logoUrl ?? null,
      address: company ? [company.address, company.city].filter(Boolean).join(", ") || null : null,
      phone: company?.phone ?? null,
      footer: company?.ticketFooter ?? null,
    },
  };
}

const RETURN_TYPE_LABELS: Record<string, string> = {
  exchange: "Cambio de producto",
  refund: "Devolución de dinero",
  coupon: "Cupón",
  points: "Bonificación en puntos",
};

export async function generateTicketPdf(
  organizationId: string,
  saleId: string,
  paperWidth: TicketPaperWidth = 80,
  opts: { reprint?: boolean } = {}
): Promise<Buffer> {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, organizationId },
    include: {
      location: true,
      customer: true,
      items: { include: { unit: true }, orderBy: { id: "asc" } },
      payments: true,
      discounts: true,
      cashier: true,
      cashRegister: true,
      orders: { select: { orderNumber: true, deliveryMethod: true }, take: 1 },
      returns: { where: { status: { not: "rejected" } }, select: { returnNumber: true, returnType: true, total: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!sale) throw new Error("Venta no encontrada");
  const { company, pointValue } = await companyOf(organizationId);
  const order = sale.orders[0] ?? null;
  const tip = Number(sale.tip);
  const paid = sale.payments.reduce((s, p) => s + Number(p.amount), 0);

  const totals: TicketModel["totals"] = [{ label: "Subtotal", amount: MXN(Number(sale.subtotal)) }];
  for (const d of sale.discounts) totals.push({ label: d.label, amount: `-${MXN(Number(d.amount))}` });
  totals.push({ label: "Impuestos", amount: MXN(Number(sale.tax)) });
  if (Number(sale.pointsRedeemed) > 0) totals.push({ label: `Puntos canjeados (${Math.floor(Number(sale.pointsRedeemed))})`, amount: `-${MXN(Number(sale.pointsRedeemed) * pointValue)}` });
  totals.push({ label: "TOTAL", amount: MXN(Number(sale.total)), big: true });
  if (tip > 0) {
    totals.push({ label: "Propina", amount: MXN(tip) });
    totals.push({ label: "TOTAL PAGADO", amount: MXN(Number(sale.total) + tip), strong: true });
  }
  if (Number(sale.changeGiven) > 0) totals.push({ label: "Cambio", amount: MXN(Number(sale.changeGiven)) });

  const extras: string[] = [];
  if (sale.customer) {
    extras.push(`Puntos ganados: ${Math.floor(Number(sale.pointsEarned))}`);
    extras.push(`Puntos totales: ${Math.floor(Number(sale.customer.points))}`);
  }

  const observations = sale.returns.map(
    (r) => `Venta con devolución DEV-${Number(r.returnNumber)} (${RETURN_TYPE_LABELS[r.returnType] ?? r.returnType}) por ${MXN(Number(r.total))} · ${r.createdAt.toLocaleDateString("es-MX")}`
  );
  void paid;

  return renderTicketPdf({
    paperWidth,
    company,
    locationName: sale.location.name,
    title: order ? "VENTA POR PEDIDO" : undefined,
    folio: order ? `Ticket: PED-${Number(order.orderNumber)} (#${Number(sale.locationSaleNumber ?? sale.saleNumber)})` : `Ticket: ${Number(sale.locationSaleNumber ?? sale.saleNumber)}`,
    date: sale.createdAt,
    register: sale.cashRegister?.name,
    cashier: sale.cashier?.fullName,
    meta: order ? [order.deliveryMethod === "delivery" ? "Entrega: a domicilio" : "Entrega: recoger en sucursal"] : [],
    customer: sale.customer ? { name: sale.customer.fullName, code: sale.customer.customerCode } : null,
    items: sale.items.map((i) => {
      const details: string[] = [];
      if (i.bulkQuantityDisplay) details.push(i.bulkQuantityDisplay);
      if (Array.isArray(i.selectedOptions)) {
        for (const selected of i.selectedOptions as Array<{ optionName?: string; value?: string; extraPrice?: number; values?: Array<{ value?: string; extraPrice?: number }> }>) {
          const vals = (selected.values ?? [{ value: selected.value, extraPrice: selected.extraPrice }])
            .map((v) => `${v.value ?? ""}${Number(v.extraPrice ?? 0) > 0 ? ` +${MXN(Number(v.extraPrice))}` : ""}`)
            .filter(Boolean)
            .join(", ");
          if (vals) details.push(`${selected.optionName ?? "Opción"}: ${vals}`);
        }
      }
      return {
        title: [i.productName, i.variantName && i.variantName !== "Default" ? i.variantName : null].filter(Boolean).join(" · "),
        details,
        qty: `${Number(i.quantity)} x ${MXN(Number(i.unitPrice))}`,
        amount: MXN(Number(i.lineTotal ?? 0)),
        note: i.notes ?? undefined,
      };
    }),
    totals,
    payments: sale.payments.map((p) => ({ label: PAYMENT_LABELS[p.method] ?? p.method, amount: MXN(Number(p.amount)) })),
    extras,
    observations,
    barcodeText: buildTicketCode({ saleId: sale.id }),
    barcodeCaption: "Escanea para consultar la venta",
    reprint: opts.reprint,
  });
}

export async function generateReturnTicketPdf(
  organizationId: string,
  returnId: string,
  paperWidth: TicketPaperWidth = 80,
  opts: { reprint?: boolean } = {}
): Promise<Buffer> {
  const ret = await getReturnDetail(organizationId, returnId);
  const [{ company }, location] = await Promise.all([companyOf(organizationId), prisma.location.findUnique({ where: { id: ret.locationId }, select: { name: true } })]);
  const order = await prisma.order.findFirst({ where: { saleId: ret.saleId, organizationId }, select: { orderNumber: true } });
  const STATUS: Record<string, string> = { pending: "Pendiente", approved: "Aprobada", completed: "Procesada", rejected: "Rechazada" };
  const exchange = (Array.isArray(ret.exchangeItems) ? ret.exchangeItems : []) as { name: string; quantity: number; unitPrice: number }[];
  const exchangeTotal = exchange.reduce((s, e) => s + e.quantity * e.unitPrice, 0);

  const totals: TicketModel["totals"] = [
    { label: "Subtotal", amount: MXN(Number(ret.subtotal)) },
    { label: "Impuestos", amount: MXN(Number(ret.tax)) },
    { label: "TOTAL DEVUELTO", amount: MXN(Number(ret.total)), big: true },
  ];
  const payments: TicketModel["payments"] = [];
  const extras: string[] = [];
  if (ret.couponCode) {
    extras.push(`Cupón: ${ret.couponCode}`, `Monto: ${MXN(Number(ret.couponAmount))}`);
    if (ret.couponExpiresAt) extras.push(`Vence: ${new Date(ret.couponExpiresAt).toLocaleDateString("es-MX")}`);
  } else if (ret.pointsAwarded) {
    extras.push(`Puntos bonificados: ${Number(ret.pointsAwarded)}`);
  } else if (ret.returnType === "refund") {
    for (const p of ret.refundPayments) payments.push({ label: `${PAYMENT_LABELS[p.method] ?? p.method}${p.reference ? ` · ${p.reference}` : ""}`, amount: MXN(Number(p.amount)) });
  } else if (ret.returnType === "exchange" && exchange.length) {
    extras.push("PRODUCTO ENTREGADO:");
    for (const e of exchange) extras.push(`${e.quantity} x ${e.name}  ${MXN(e.quantity * e.unitPrice)}`);
    const diff = Math.round((exchangeTotal - Number(ret.total)) * 100) / 100;
    extras.push(diff > 0 ? `Diferencia a pagar: ${MXN(diff)}` : diff < 0 ? `Diferencia a favor: ${MXN(-diff)}` : "Sin diferencia");
  }

  return renderTicketPdf({
    paperWidth,
    company,
    locationName: location?.name ?? "",
    title: "TICKET DE DEVOLUCIÓN",
    folio: `Devolución: DEV-${Number(ret.returnNumber)}`,
    date: ret.createdAt,
    cashier: ret.user?.fullName ?? ret.employee?.fullName ?? null,
    meta: [
      `Venta original: ${order ? `PED-${Number(order.orderNumber)} (#${Number(ret.sale.locationSaleNumber ?? ret.sale.saleNumber)})` : `#${Number(ret.sale.locationSaleNumber ?? ret.sale.saleNumber)}`}`,
      `Tipo: ${RETURN_TYPE_LABELS[ret.returnType] ?? ret.returnType}`,
      `Estado: ${STATUS[ret.status] ?? ret.status}`,
    ],
    customer: ret.sale.customer ? { name: ret.sale.customer.fullName, code: ret.sale.customer.customerCode } : null,
    itemsHeading: "PRODUCTOS DEVUELTOS",
    items: ret.items.map((i) => ({
      title: [i.productName, i.variantName && i.variantName !== "Default" ? i.variantName : null].filter(Boolean).join(" · "),
      details: [],
      qty: `${Number(i.quantity)} x ${MXN(Number(i.unitPrice))}`,
      amount: MXN(Number(i.lineTotal)),
      note: i.reason ?? undefined,
    })),
    totals,
    payments,
    extras,
    observations: ret.reason ? [`Motivo: ${ret.reason}`] : [],
    thanks: "Gracias por su preferencia",
    barcodeText: buildTicketCode({ saleId: ret.sale.id }),
    barcodeCaption: "Escanea para consultar la venta original",
    reprint: opts.reprint,
  });
}
