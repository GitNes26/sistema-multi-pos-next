import { NextResponse } from "next/server";
import { createSale, PosError } from "@/lib/pos/server";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/db";
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
  const organizationId = effectiveOrgId(session)!;

  try {
    const body = (await req.json()) as { locationId?: string; payload: PosSalePayload };

    // Guard: validar que haya una sesión de caja abierta
    if (!body.payload.cashSessionId) {
      return NextResponse.json(
        { ok: false, error: "No hay sesión de caja abierta. Abre la caja antes de realizar ventas." },
        { status: 400 }
      );
    }
    const openSession = await prisma.cashSession.findFirst({
      where: {
        id: body.payload.cashSessionId,
        organizationId,
        status: "open",
      },
      select: { id: true },
    });
    if (!openSession) {
      return NextResponse.json(
        { ok: false, error: "La sesión de caja no está abierta. Abre la caja antes de realizar ventas." },
        { status: 400 }
      );
    }

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