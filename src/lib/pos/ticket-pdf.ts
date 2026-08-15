import PDFDocument from "pdfkit";
import { prisma } from "@/lib/db";
import type { $Enums } from "@prisma/client";

// FASE 6.12 (rediseño) — Ticket térmico en PDF (80mm) para impresión.

const MXN = (n: number) =>
  n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

const PAYMENT_LABELS: Record<$Enums.PaymentMethod, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  wallet: "Wallet",
  other: "Otro",
  points: "Puntos",
};

export async function generateTicketPdf(organizationId: string, saleId: string): Promise<Buffer> {
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

  const company = await prisma.companyProfile.findUnique({ where: { organizationId } });

  const doc = new PDFDocument({ size: [226.77, 840], margin: 12 });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const center = () => doc.text("", { align: "center" });
  const line = (l: string, r: string) => {
    doc.font("Helvetica");
    doc.fontSize(8).text(l, 12, undefined, { continued: true });
    doc.text(r, { align: "right" });
  };

  // Encabezado
  doc.font("Helvetica-Bold");
  doc.fontSize(11).text(`${company?.tradeName ?? company?.legalName ?? "Empresa"} - ${sale.location.name}`, { align: "center" });
  doc.font("Helvetica").fontSize(7);
  if (company?.address) doc.text([company.address, company.city].filter(Boolean).join(", "), { align: "center" });
  if (company?.phone) doc.text(`Tel: ${company.phone}`, { align: "center" });
  doc.text(`Ticket: ${sale.saleNumber}`, { align: "center" });
  doc.text(new Date(sale.createdAt).toLocaleString("es-MX"), { align: "center" });
  if (sale.cashRegister) doc.text(`Caja: ${sale.cashRegister.name}`, { align: "center" });
  doc.text(`Cajero: ${sale.cashier?.fullName ?? "—"}`, { align: "center" });
  center();

  doc.moveTo(12, doc.y).lineTo(214.77, doc.y).dash(2, { space: 2 }).stroke();
  doc.undash();

  // Cliente
  if (sale.customer) {
    doc.font("Helvetica-Bold").fontSize(8).text("Cliente:");
    doc.font("Helvetica").text(`${sale.customer.fullName}${sale.customer.customerCode ? ` · Nº ${sale.customer.customerCode}` : ""}`);
  }

  // Items
  for (const i of sale.items) {
    doc.font("Helvetica-Bold").fontSize(8).text(i.productName);
    doc.font("Helvetica");
    if (i.bulkQuantityDisplay) doc.fontSize(7).text(i.bulkQuantityDisplay);
    doc.fontSize(7).text(`${Number(i.quantity)} x ${MXN(Number(i.unitPrice))}`, { continued: true });
    doc.text(MXN(Number(i.lineTotal ?? 0)), { align: "right" });
  }

  doc.moveTo(12, doc.y).lineTo(214.77, doc.y).dash(2, { space: 2 }).stroke();
  doc.undash();

  line("Subtotal", MXN(Number(sale.subtotal)));
  for (const d of sale.discounts) line(d.label, `-${MXN(Number(d.amount))}`);
  line("Impuestos", MXN(Number(sale.tax)));
  if (Number(sale.pointsRedeemed) > 0) line(`Puntos canjeados (${sale.pointsRedeemed})`, `-${MXN(Number(sale.pointsRedeemed ?? 0))}`);
  doc.font("Helvetica-Bold").fontSize(10);
  line("TOTAL", MXN(Number(sale.total)));
  doc.font("Helvetica").fontSize(8);
  if (Number(sale.changeGiven) > 0) line("Cambio", MXN(Number(sale.changeGiven)));

  doc.moveTo(12, doc.y).lineTo(214.77, doc.y).dash(2, { space: 2 }).stroke();
  doc.undash();

  for (const p of sale.payments) line(PAYMENT_LABELS[p.method], MXN(Number(p.amount)));

  if (sale.customer) {
    doc.font("Helvetica").fontSize(8).text(`Puntos ganados: ${Math.floor(Number(sale.pointsEarned))}`);
    const newPoints = Math.floor(Number(sale.customer.points) + Number(sale.pointsEarned) - Number(sale.pointsRedeemed));
    doc.text(`Puntos totales: ${newPoints}`);
  }

  doc.font("Helvetica-Bold").fontSize(8).text("¡Gracias por su compra!", { align: "center" });

  doc.end();
  return result;
}
