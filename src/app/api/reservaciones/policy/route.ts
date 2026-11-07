import { NextRequest, NextResponse } from "next/server";
import { getRentalPolicy, saveRentalPolicy } from "@/lib/reservations/server";
import { reservationErrorResponse, requireReservationsSession } from "../helpers";

export const dynamic = "force-dynamic";

// Política de rentas: depósito sugerido, cargo por día de retraso y minutos de gracia.
export async function GET() {
  const guard = await requireReservationsSession("reservations.view");
  if ("response" in guard) return guard.response;
  try {
    return NextResponse.json({ ok: true, policy: await getRentalPolicy(guard.organizationId) });
  } catch (err) {
    return reservationErrorResponse(err);
  }
}

export async function PUT(req: NextRequest) {
  const guard = await requireReservationsSession("reservations.manage");
  if ("response" in guard) return guard.response;
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
    const policy = await saveRentalPolicy(guard.organizationId, {
      defaultDeposit: Number(body.defaultDeposit ?? 0),
      lateFeePerDay: Number(body.lateFeePerDay ?? 0),
      graceMinutes: Number(body.graceMinutes ?? 60),
    });
    return NextResponse.json({ ok: true, policy });
  } catch (err) {
    return reservationErrorResponse(err);
  }
}
