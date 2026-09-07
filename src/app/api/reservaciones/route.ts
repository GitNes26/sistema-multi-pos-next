import { NextRequest, NextResponse } from "next/server";
import { reservationErrorResponse, requireReservationsSession } from "./helpers";
import {
  createReservation,
  getRentableUnits,
  getReservations,
} from "@/lib/reservations/server";

export const dynamic = "force-dynamic";

// Reservaciones que tocan [from, to) + artículos rentables (disponibilidad).
export async function GET(req: NextRequest) {
  const guard = await requireReservationsSession("reservations.view");
  if ("response" in guard) return guard.response;
  const { organizationId } = guard;

  try {
    const fromRaw = req.nextUrl.searchParams.get("from");
    const toRaw = req.nextUrl.searchParams.get("to");
    const from = fromRaw ? new Date(fromRaw) : new Date();
    const to = toRaw ? new Date(toRaw) : new Date(from.getTime() + 86400000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
      return NextResponse.json({ ok: false, error: "Rango de fechas inválido" }, { status: 400 });
    }
    const [reservations, units] = await Promise.all([
      getReservations(organizationId, from, to),
      getRentableUnits(organizationId),
    ]);
    return NextResponse.json({ ok: true, reservations, units });
  } catch (err) {
    return reservationErrorResponse(err);
  }
}

// Crea una reservación (pending): valida unidades por día del período.
export async function POST(req: NextRequest) {
  const guard = await requireReservationsSession("reservations.manage");
  if ("response" in guard) return guard.response;
  const { organizationId } = guard;

  try {
    const body = await req.json();
    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    if (!body.customerId || !Array.isArray(body.items) || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return NextResponse.json(
        { ok: false, error: "Faltan datos: cliente, artículos y período" },
        { status: 400 }
      );
    }
    const reservation = await createReservation(organizationId, {
      customerId: String(body.customerId),
      items: body.items.map((it: Record<string, unknown>) => ({
        variantId: String(it.variantId),
        quantity: Number(it.quantity),
      })),
      startsAt,
      endsAt,
      notes: body.notes ? String(body.notes) : null,
    });
    return NextResponse.json({ ok: true, id: reservation.id }, { status: 201 });
  } catch (err) {
    return reservationErrorResponse(err);
  }
}