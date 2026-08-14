import { NextResponse } from "next/server";
import { createSale, PosError } from "@/lib/pos/server";
import {
  requirePosSession,
  resolveLocationId,
  getCashierContext,
} from "../helpers";
import type { PosSalePayload } from "@/types/pos";

export async function POST(req: Request) {
  const guard = await requirePosSession();
  if ("response" in guard) return guard.response;
  const { session } = guard;
  const organizationId = session.user.organizationId!;

  try {
    const body = (await req.json()) as { locationId?: string; payload: PosSalePayload };
    const locationId = await resolveLocationId(organizationId, body.locationId);
    const sale = await createSale(organizationId, locationId, body.payload, {
      userId: session.user.id,
      employeeId: (await getCashierContext(session.user.id, organizationId)).employeeId,
    });
    return NextResponse.json({ ok: true, sale });
  } catch (err) {
    if (err instanceof PosError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    console.error("[pos/sales]", err);
    return NextResponse.json({ ok: false, error: "Error al registrar la venta" }, { status: 500 });
  }
}