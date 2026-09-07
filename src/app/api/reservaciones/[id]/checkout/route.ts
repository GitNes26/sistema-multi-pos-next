import { NextRequest, NextResponse } from "next/server";
import type { $Enums } from "@prisma/client";
import { checkoutReservation } from "@/lib/reservations/server";
import {
  reservationErrorResponse,
  requireReservationsSession,
  resolveReservationEmployeeId,
} from "../../helpers";

export const dynamic = "force-dynamic";

const METHODS: $Enums.PaymentMethod[] = ["cash", "card", "wallet", "other"];

// Cobra la reservación: crea la venta del período, la liga (saleId) y la
// marca como completada. Permiso: reservations.manage (operador de rentas).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireReservationsSession("reservations.manage");
  if ("response" in guard) return guard.response;
  const { organizationId, session } = guard;
  const { id } = await ctx.params;

  try {
    const body = await req.json().catch(() => ({}));
    const method = (body.method ?? "cash") as $Enums.PaymentMethod;
    if (!METHODS.includes(method)) {
      return NextResponse.json({ ok: false, error: "Método de pago inválido" }, { status: 400 });
    }
    const employeeId = await resolveReservationEmployeeId(session.user.id, organizationId);
    const result = await checkoutReservation(organizationId, id, method, {
      userId: session.user.id,
      employeeId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return reservationErrorResponse(err);
  }
}