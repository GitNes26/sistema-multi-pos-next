import { NextRequest, NextResponse } from "next/server";
import { salesGuard, salesErrorResponse } from "../../../guard";
import { generateReturnTicketPdf } from "@/lib/pos/ticket-pdf";

// GET /api/sales/returns/[returnId]/ticket — Ticket de devolución (mismo diseño que el de ventas).
// ?reprint=1 agrega la marca de agua «REIMPRESIÓN»; ?paper=58|80 el ancho.
export async function GET(req: NextRequest, { params }: { params: Promise<{ returnId: string }> }) {
  const guard = await salesGuard("sales.view");
  if (guard instanceof NextResponse) return guard;
  try {
    const { returnId } = await params;
    const sp = new URL(req.url).searchParams;
    const buffer = await generateReturnTicketPdf(guard.organizationId, returnId, sp.get("paper") === "58" ? 58 : 80, { reprint: sp.get("reprint") === "1" });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="devolucion-${returnId.slice(-8)}.pdf"`,
      },
    });
  } catch (err) {
    return salesErrorResponse(err);
  }
}
