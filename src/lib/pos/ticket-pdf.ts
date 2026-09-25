import PDFDocument from "pdfkit";
import { prisma } from "@/lib/db";
import type { $Enums } from "@prisma/client";
import bwipjs from "bwip-js/node";
import { buildTicketCode } from "@/lib/sales/ticket-code";

// FASE 6.12 (rediseño) — Ticket térmico en PDF (80mm) para impresión.

const MXN = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const PAYMENT_LABELS: Record<$Enums.PaymentMethod, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  wallet: "Wallet",
  other: "Otro",
  points: "Puntos",
  credit: "Crédito",
};

export type TicketPaperWidth = 58 | 80;

export async function generateTicketPdf(organizationId: string, saleId: string, paperWidth: TicketPaperWidth = 80): Promise<Buffer> {
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
    },
  });
  if (!sale) throw new Error("Venta no encontrada");

  const [company, organization] = await Promise.all([
    prisma.companyProfile.findUnique({
      where: { organizationId },
      select: { tradeName: true, legalName: true, logoUrl: true, address: true, city: true, phone: true, ticketFooter: true },
    }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { pointValue: true } }),
  ]);

  const optionLineCount = sale.items.reduce((sum, item) => sum + (Array.isArray(item.selectedOptions) ? item.selectedOptions.length : 0), 0);
  const estimatedHeight = Math.max(490, 390 + sale.items.length * 42 + optionLineCount * 12 + sale.discounts.length * 14 + sale.payments.length * 14 + (company?.ticketFooter ? 40 : 0));

  const pageWidth = paperWidth * 2.83465;
  const margin = paperWidth === 58 ? 9 : 12;
  const contentWidth = pageWidth - margin * 2;
  const amountWidth = paperWidth === 58 ? 54 : 74;
  const doc = new PDFDocument({
    size: [pageWidth, estimatedHeight],
    margin,
    font: "Courier",
  });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const line = (l: string, r: string) => {
    const y = doc.y;
    doc.font("Courier").fontSize(paperWidth === 58 ? 7 : 8).text(l, margin, y, { width: contentWidth - amountWidth - 4, lineBreak: false, ellipsis: true });
    doc.text(r, pageWidth - margin - amountWidth, y, { align: "right", width: amountWidth, lineBreak: false });
    doc.y = y + 11;
  };

  // Logo de la empresa — use absolute URL
  if (company?.logoUrl) {
    try {
      const logoUrl = company.logoUrl.startsWith("http")
        ? company.logoUrl
        : `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}${company.logoUrl}`;
      const res = await fetch(logoUrl);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const imgWidth = 40;
        const imgX = (pageWidth - imgWidth) / 2;
        doc.image(buf, imgX, doc.y, { width: imgWidth });
        doc.moveDown(1.5);
      }
    } catch {
      // Si falla la imagen, continuar sin logo
    }
  }

  // Encabezado — monospace to match receipt
  doc.font("Courier-Bold");
  doc.fontSize(paperWidth === 58 ? 10 : 12).text(company?.tradeName ?? company?.legalName ?? "Empresa", margin, doc.y, { align: "center", width: contentWidth });
  doc.fontSize(8).text(sale.location.name, { align: "center", width: contentWidth });
  doc.font("Courier").fontSize(7);
  if (company?.address) doc.text([company.address, company.city].filter(Boolean).join(", "), { align: "center", width: contentWidth });
  if (company?.phone) doc.text(`Tel: ${company.phone}`, { align: "center", width: contentWidth });
  doc.text(`Ticket: ${sale.saleNumber}`, { align: "center", width: contentWidth });
  doc.text(new Date(sale.createdAt).toLocaleString("es-MX"), { align: "center", width: contentWidth });
  if (sale.cashRegister) doc.text(`Caja: ${sale.cashRegister.name}`, { align: "center", width: contentWidth });
  doc.text(`Cajero: ${sale.cashier?.fullName ?? "—"}`, { align: "center", width: contentWidth });

  doc.moveTo(margin, doc.y + 4).lineTo(pageWidth - margin, doc.y + 4).dash(2, { space: 2 }).stroke();
  doc.undash();
  doc.moveDown(1);

  // Cliente
  if (sale.customer) {
    doc.font("Courier-Bold").fontSize(8).text("Cliente:", margin);
    doc.font("Courier").text(`${sale.customer.fullName}${sale.customer.customerCode ? ` · Nº ${sale.customer.customerCode}` : ""}`, margin);
    doc.moveDown(0.5);
  }

  // Items
  for (const i of sale.items) {
    doc.font("Courier-Bold").fontSize(8).text([i.productName, i.variantName].filter(Boolean).join(" · "), margin, doc.y, { width: contentWidth });
    doc.font("Courier").fontSize(7);
    if (i.bulkQuantityDisplay) doc.text(i.bulkQuantityDisplay, margin, doc.y, { width: contentWidth });
    if (Array.isArray(i.selectedOptions)) {
      for (const selected of i.selectedOptions as Array<{ optionName?: string; value?: string; extraPrice?: number; values?: Array<{ value?: string; extraPrice?: number }> }>) {
        const normalizedValues = selected.values ?? [{ value: selected.value, extraPrice: selected.extraPrice }];
        const values = normalizedValues.map((value) => `${value.value ?? ""}${Number(value.extraPrice ?? 0) > 0 ? ` +${MXN(Number(value.extraPrice))}` : ""}`).filter(Boolean).join(", ");
        if (values) doc.text(`${selected.optionName ?? "Opción"}: ${values}`, margin + 4, doc.y, { width: contentWidth - 4 });
      }
    }
    line(`${Number(i.quantity)} x ${MXN(Number(i.unitPrice))}`, MXN(Number(i.lineTotal ?? 0)));
  }

  doc.moveTo(margin, doc.y + 4).lineTo(pageWidth - margin, doc.y + 4).dash(2, { space: 2 }).stroke();
  doc.undash();
  doc.moveDown(0.5);

  line("Subtotal", MXN(Number(sale.subtotal)));
  for (const d of sale.discounts) line(d.label, `-${MXN(Number(d.amount))}`);
  line("Impuestos", MXN(Number(sale.tax)));
  if (Number(sale.pointsRedeemed) > 0) {
    const redeemedValue = Number(sale.pointsRedeemed) * Number(organization?.pointValue ?? 0);
    line(`Puntos canjeados (${Math.floor(Number(sale.pointsRedeemed))})`, `-${MXN(redeemedValue)}`);
  }
  doc.moveDown(0.25);
  doc.font("Courier-Bold").fontSize(11);
  line("TOTAL", MXN(Number(sale.total)));
  doc.font("Courier").fontSize(8);
  if (Number(sale.changeGiven) > 0) line("Cambio", MXN(Number(sale.changeGiven)));

  doc.moveTo(margin, doc.y + 4).lineTo(pageWidth - margin, doc.y + 4).dash(2, { space: 2 }).stroke();
  doc.undash();
  doc.moveDown(0.5);

  for (const p of sale.payments) line(PAYMENT_LABELS[p.method], MXN(Number(p.amount)));

  if (sale.customer) {
    doc.font("Courier").fontSize(8);
    doc.text(`Puntos ganados: ${Math.floor(Number(sale.pointsEarned))}`, margin);
    const newPoints = Math.floor(Number(sale.customer.points));
    doc.text(`Puntos totales: ${newPoints}`, margin);
  }

  doc.moveDown(1);
  if (company?.ticketFooter) {
    doc.font("Courier").fontSize(7).text(company.ticketFooter, { align: "center", width: contentWidth });
    doc.moveDown(0.5);
  }
  doc.font("Courier-Bold").fontSize(8).text("¡Gracias por su compra!", { align: "center", width: contentWidth });

  const ticketCode = buildTicketCode({ saleId: sale.id });
  const barcode = await bwipjs.toBuffer({ bcid: "code128", text: ticketCode, height: 10, scale: 2, includetext: false, padding: 0 });
  doc.moveDown(0.7);
  doc.image(barcode, margin + 4, doc.y, { fit: [contentWidth - 8, 34], align: "center" });
  doc.moveDown(3.4);
  doc.font("Courier").fontSize(6).text("Escanea para consultar la venta", { align: "center", width: contentWidth });

  doc.end();
  return result;
}
