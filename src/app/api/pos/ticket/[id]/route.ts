import { NextResponse } from "next/server";
import { requirePosSession } from "../../helpers";
import { generateTicketPdf } from "@/lib/pos/ticket-pdf";

// FASE 6.12 — Ticket en PDF (80mm) para impresión.

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePosSession();
  if ("response" in guard) return guard.response;
  const organizationId = guard.session.user.organizationId!;

  const { id } = await params;
  try {
    const buffer = await generateTicketPdf(organizationId, id);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="ticket-${id}.pdf"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Error al generar el ticket" },
      { status: 500 }
    );
  }
}
