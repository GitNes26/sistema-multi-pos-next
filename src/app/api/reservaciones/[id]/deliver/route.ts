import { NextRequest, NextResponse } from "next/server";
import { deliverReservation } from "@/lib/reservations/server";
import { reservationErrorResponse, requireReservationsSession } from "../../helpers";

export const dynamic = "force-dynamic";

// Entrega el equipo al cliente (exige la revisión de entrega si es obligatoria).
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireReservationsSession("reservations.manage");
  if ("response" in guard) return guard.response;
  const { id } = await ctx.params;
  try {
    return NextResponse.json({ ok: true, ...(await deliverReservation(guard.organizationId, id)) });
  } catch (err) {
    return reservationErrorResponse(err);
  }
}
