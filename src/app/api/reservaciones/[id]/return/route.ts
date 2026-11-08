import { NextRequest, NextResponse } from "next/server";
import { returnReservation } from "@/lib/reservations/server";
import { reservationErrorResponse, requireReservationsSession } from "../../helpers";

export const dynamic = "force-dynamic";

// Recibe el equipo: retraso según la política, cargo por daños y liquidación del depósito.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireReservationsSession("reservations.manage");
  if ("response" in guard) return guard.response;
  const { id } = await ctx.params;
  try {
    const body = (await req.json().catch(() => ({}))) as { damageFee?: unknown; penaltyNotes?: unknown };
    const result = await returnReservation(guard.organizationId, id, {
      damageFee: body.damageFee === undefined || body.damageFee === "" ? 0 : Number(body.damageFee),
      penaltyNotes: body.penaltyNotes ? String(body.penaltyNotes) : null,
    }, guard.session.user.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return reservationErrorResponse(err);
  }
}
