import { NextResponse } from "next/server";
import { closeCashSession, openCashSession, getSalesStats } from "@/lib/pos/server";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { requirePosSession, resolveLocationId } from "../helpers";

export async function GET(req: Request) {
  const guard = await requirePosSession();
  if ("response" in guard) return guard.response;
  const { session } = guard;
  const organizationId = effectiveOrgId(session)!;
  const { searchParams } = new URL(req.url);
  const locationId = await resolveLocationId(organizationId, searchParams.get("locationId"));
  const stats = await getSalesStats(organizationId, locationId);
  return NextResponse.json({ ok: true, ...stats });
}

export async function POST(req: Request) {
  const guard = await requirePosSession();
  if ("response" in guard) return guard.response;
  const { session } = guard;
  const organizationId = effectiveOrgId(session)!;

  try {
    const body = (await req.json()) as {
      action: "open" | "close";
      locationId?: string;
      registerId?: string;
      openingCash?: number;
      closingCash?: number;
      sessionId?: string;
      notes?: string;
    };
    const locationId = await resolveLocationId(organizationId, body.locationId);

    if (body.action === "open") {
      if (!body.registerId) {
        return NextResponse.json({ ok: false, error: "Selecciona una caja registradora" }, { status: 400 });
      }
      const result = await openCashSession(
        organizationId,
        locationId,
        body.registerId,
        body.openingCash ?? 0,
        session.user.id
      );
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === "close") {
      if (!body.sessionId) {
        return NextResponse.json({ ok: false, error: "No hay sesión de caja abierta" }, { status: 400 });
      }
      const summary = await closeCashSession(
        organizationId,
        body.sessionId,
        body.closingCash ?? 0,
        body.notes
      );
      return NextResponse.json({ ok: true, summary });
    }

    return NextResponse.json({ ok: false, error: "Acción no válida" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error en la caja";
    const status = message.includes("no está abierta") ? 400 : 500;
    console.error("[pos/cash]", err);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}