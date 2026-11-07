import { NextRequest, NextResponse } from "next/server";
import { ChecklistError, listTemplates, saveTemplate } from "@/lib/checklists/server";
import { reservationErrorResponse, requireReservationsSession } from "../helpers";

export const dynamic = "force-dynamic";

function fail(err: unknown) {
  if (err instanceof ChecklistError) return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
  return reservationErrorResponse(err);
}

// Listas de revisión de las rentas (entrega y devolución).
export async function GET() {
  const guard = await requireReservationsSession("reservations.view");
  if ("response" in guard) return guard.response;
  try {
    return NextResponse.json({ ok: true, templates: await listTemplates(guard.organizationId, "reservation") });
  } catch (err) {
    return fail(err);
  }
}

// Crea, reemplaza o quita (sin puntos) la lista de una fase.
export async function PUT(req: NextRequest) {
  const guard = await requireReservationsSession("reservations.manage");
  if ("response" in guard) return guard.response;
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
    if (body.phase !== "delivery" && body.phase !== "return") return NextResponse.json({ ok: false, error: "Fase no válida" }, { status: 400 });
    const items = Array.isArray(body.items) ? (body.items as { label?: unknown; requirePhoto?: unknown }[]).map((i) => ({ label: String(i.label ?? ""), requirePhoto: i.requirePhoto !== false })) : [];
    const template = await saveTemplate(guard.organizationId, {
      subjectType: "reservation",
      phase: body.phase,
      name: body.name ? String(body.name) : undefined,
      isRequired: body.isRequired === true,
      items,
    });
    return NextResponse.json({ ok: true, template });
  } catch (err) {
    return fail(err);
  }
}
