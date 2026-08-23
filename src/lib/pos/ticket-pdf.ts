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

  const doc = new PDFDocument({
    size: [226.77, 840],
    margin: 12,
    font: "Courier",
  });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const line = (l: string, r: string) => {
    doc.font("Courier").fontSize(8);
    doc.text(l, 12, undefined, { continued: true, width: 200 });
    doc.text(r, { align: "right", width: 200 });
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
        const imgX = (226.77 - imgWidth) / 2;
        doc.image(buf, imgX, doc.y, { width: imgWidth });
        doc.moveDown(1.5);
      }
    } catch {
      // Si falla la imagen, continuar sin logo
    }
  }

  // Encabezado — monospace to match receipt
  doc.font("Courier-Bold");
  doc.fontSize(10).text(`${company?.tradeName ?? company?.legalName ?? "Empresa"} - ${sale.location.name}`, 12, doc.y, { align: "center", width: 200 });
  doc.font("Courier").fontSize(7);
  if (company?.address) doc.text([company.address, company.city].filter(Boolean).join(", "), { align: "center", width: 200 });
  if (company?.phone) doc.text(`Tel: ${company.phone}`, { align: "center", width: 200 });
  doc.text(`Ticket: ${sale.saleNumber}`, { align: "center", width: 200 });
  doc.text(new Date(sale.createdAt).toLocaleString("es-MX"), { align: "center", width: 200 });
  if (sale.cashRegister) doc.text(`Caja: ${sale.cashRegister.name}`, { align: "center", width: 200 });
  doc.text(`Cajero: ${sale.cashier?.fullName ?? "—"}`, { align: "center", width: 200 });

  doc.moveTo(12, doc.y + 4).lineTo(214.77, doc.y + 4).dash(2, { space: 2 }).stroke();
  doc.undash();
  doc.moveDown(1);

  // Cliente
  if (sale.customer) {
    doc.font("Courier-Bold").fontSize(8).text("Cliente:", 12);
    doc.font("Courier").text(`${sale.customer.fullName}${sale.customer.customerCode ? ` · Nº ${sale.customer.customerCode}` : ""}`, 12);
    doc.moveDown(0.5);
  }

  // Items
  for (const i of sale.items) {
    doc.font("Courier-Bold").fontSize(8).text(i.productName, 12);
    doc.font("Courier").fontSize(7);
    if (i.bulkQuantityDisplay) doc.text(i.bulkQuantityDisplay, 12);
    doc.text(`${Number(i.quantity)} x ${MXN(Number(i.unitPrice))}`, 12, doc.y, { continued: true, width: 200 });
    doc.text(MXN(Number(i.lineTotal ?? 0)), { align: "right", width: 200 });
  }

  doc.moveTo(12, doc.y + 4).lineTo(214.77, doc.y + 4).dash(2, { space: 2 }).stroke();
  doc.undash();
  doc.moveDown(0.5);

  line("Subtotal", MXN(Number(sale.subtotal)));
  for (const d of sale.discounts) line(d.label, `-${MXN(Number(d.amount))}`);
  line("Impuestos", MXN(Number(sale.tax)));
  if (Number(sale.pointsRedeemed) > 0) line(`Puntos canjeados (${sale.pointsRedeemed})`, `-${MXN(Number(sale.pointsRedeemed ?? 0))}`);
  doc.font("Courier-Bold").fontSize(10);
  line("TOTAL", MXN(Number(sale.total)));
  doc.font("Courier").fontSize(8);
  if (Number(sale.changeGiven) > 0) line("Cambio", MXN(Number(sale.changeGiven)));

  doc.moveTo(12, doc.y + 4).lineTo(214.77, doc.y + 4).dash(2, { space: 2 }).stroke();
  doc.undash();
  doc.moveDown(0.5);

  for (const p of sale.payments) line(PAYMENT_LABELS[p.method], MXN(Number(p.amount)));

  if (sale.customer) {
    doc.font("Courier").fontSize(8);
    doc.text(`Puntos ganados: ${Math.floor(Number(sale.pointsEarned))}`, 12);
    const newPoints = Math.floor(Number(sale.customer.points) + Number(sale.pointsEarned) - Number(sale.pointsRedeemed));
    doc.text(`Puntos totales: ${newPoints}`, 12);
  }

  doc.moveDown(1);
  doc.font("Courier-Bold").fontSize(8).text("¡Gracias por su compra!", { align: "center", width: 200 });

  doc.end();
  return result;
}
