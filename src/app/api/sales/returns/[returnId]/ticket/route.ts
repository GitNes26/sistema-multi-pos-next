import { NextRequest, NextResponse } from "next/server";
import { salesGuard, salesErrorResponse } from "../../../guard";
import { getReturnDetail } from "@/lib/returns/server";
import { prisma } from "@/lib/db";
import PDFDocument from "pdfkit";

// GET /api/sales/returns/[returnId]/ticket — Ticket de devolución PDF
export async function GET(req: NextRequest, { params }: { params: Promise<{ returnId: string }> }) {
  const guard = await salesGuard("sales.view");
  if (guard instanceof NextResponse) return guard;

  try {
    const { returnId } = await params;
    const ret = await getReturnDetail(guard.organizationId, returnId);
    const org = await prisma.organization.findUnique({
      where: { id: guard.organizationId },
      select: { name: true },
    });

    const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
    const TYPE_LABELS: Record<string, string> = {
      exchange: "Cambio",
      refund: "Devolución de dinero",
      coupon: "Cupón",
      points: "Bonificación en puntos",
    };
    const STATUS_LABELS: Record<string, string> = {
      pending: "Pendiente",
      approved: "Aprobada",
      completed: "Procesada",
      rejected: "Rechazada",
    };

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: [226, 400], margin: 20 }); // Thermal receipt 80mm
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const W = 186;
      const cx = 20;

      // Header
      doc.font("Helvetica-Bold").fontSize(12).text(org?.name ?? "Mi negocio", cx, 20, { width: W, align: "center" });
      doc.font("Helvetica").fontSize(8).text("TICKET DE DEVOLUCIÓN", cx, 36, { width: W, align: "center" });
      doc.moveDown(0.5);
      doc.text(`Folio: DEV-${ret.id.slice(-8).toUpperCase()}`, cx, 52, { width: W });
      doc.text(`Fecha: ${new Date(ret.createdAt).toLocaleString("es-MX")}`, cx, 62, { width: W });
      doc.text(`Tipo: ${TYPE_LABELS[ret.returnType] ?? ret.returnType}`, cx, 72, { width: W });
      doc.text(`Estado: ${STATUS_LABELS[ret.status] ?? ret.status}`, cx, 82, { width: W });

      // Venta original
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(8).text(`Venta original: #${ret.sale.locationSaleNumber ?? ret.sale.saleNumber}`, cx, 96, { width: W });

      // Items
      let y = 112;
      doc.font("Helvetica-Bold").fontSize(7);
      doc.text("PRODUCTO", cx, y, { width: 100 });
      doc.text("CANT", cx + 100, y, { width: 30, align: "right" });
      doc.text("IMPORTE", cx + 130, y, { width: 56, align: "right" });
      y += 10;
      doc.font("Helvetica").fontSize(7);

      for (const item of ret.items) {
        doc.text(item.productName, cx, y, { width: 100 });
        doc.text(String(Number(item.quantity)), cx + 100, y, { width: 30, align: "right" });
        doc.text(money(Number(item.lineTotal)), cx + 130, y, { width: 56, align: "right" });
        y += 10;
        if (item.reason) {
          doc.font("Helvetica-Oblique").fontSize(6).text(`  ${item.reason}`, cx, y, { width: W });
          doc.font("Helvetica").fontSize(7);
          y += 8;
        }
      }

      // Totals
      y += 4;
      doc.font("Helvetica-Bold").fontSize(8);
      doc.text("Subtotal:", cx, y, { width: 100 });
      doc.text(money(Number(ret.subtotal)), cx + 100, y, { width: 86, align: "right" });
      y += 10;
      doc.text("IVA:", cx, y, { width: 100 });
      doc.text(money(Number(ret.tax)), cx + 100, y, { width: 86, align: "right" });
      y += 10;
      doc.fontSize(10).text("TOTAL:", cx, y, { width: 100 });
      doc.text(money(Number(ret.total)), cx + 100, y, { width: 86, align: "right" });

      // Resolution details
      y += 20;
      doc.font("Helvetica").fontSize(7);
      if (ret.couponCode) {
        doc.text(`Cupón: ${ret.couponCode}`, cx, y, { width: W });
        y += 10;
        doc.text(`Monto: ${money(Number(ret.couponAmount))}`, cx, y, { width: W });
        y += 10;
        doc.text(`Vence: ${new Date(ret.couponExpiresAt!).toLocaleDateString("es-MX")}`, cx, y, { width: W });
      } else if (ret.pointsAwarded) {
        doc.text(`Puntos bonificados: ${Number(ret.pointsAwarded)}`, cx, y, { width: W });
      }

      // Footer
      y += 20;
      doc.fontSize(6).fillColor("666666").text("Gracias por su preferencia", cx, y, { width: W, align: "center" });

      doc.end();
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="devolucion-${ret.id.slice(-8)}.pdf"`,
      },
    });
  } catch (err) {
    return salesErrorResponse(err);
  }
}
