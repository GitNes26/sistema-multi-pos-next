import { NextRequest, NextResponse } from "next/server";
import { updateReservation } from "@/lib/reservations/server";
import { reservationErrorResponse, requireReservationsSession } from "../helpers";

export const dynamic = "force-dynamic";

// Actualiza una reservación: estatus (pending/confirmed/cancelled), período o
// notas. Al reprogramar se re-valida la disponibilidad de unidades.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireReservationsSession("reservations.manage");
  if ("response" in guard) return guard.response;
  const { organizationId } = guard;
  const { id } = await ctx.params;

  try {
    const body = await req.json();
    const updated = await updateReservation(organizationId, id, {
      status: body.status ?? undefined,
      startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
      notes: body.notes !== undefined ? String(body.notes) : undefined,
    });
    return NextResponse.json({ ok: true, reservation: updated });
  } catch (err) {
    return reservationErrorResponse(err);
  }
}