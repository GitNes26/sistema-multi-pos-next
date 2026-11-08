import { NextRequest, NextResponse } from "next/server";
import { settleRentalCash } from "@/lib/reservations/cash";
import { reservationErrorResponse, requireReservationsSession } from "../../helpers";

export const dynamic = "force-dynamic";

// Registra en la caja abierta el depósito que se regresa o el saldo que se cobra de una renta devuelta.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireReservationsSession("reservations.manage");
  if ("response" in guard) return guard.response;
  const { id } = await ctx.params;
  try {
    return NextResponse.json({ ok: true, ...(await settleRentalCash(guard.organizationId, id, guard.session.user.id)) });
  } catch (err) {
    return reservationErrorResponse(err);
  }
}
