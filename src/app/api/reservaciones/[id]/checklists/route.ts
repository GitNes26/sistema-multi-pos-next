import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ChecklistError, latestRuns, listTemplates, saveRun } from "@/lib/checklists/server";
import { reservationErrorResponse, requireReservationsSession } from "../../helpers";

export const dynamic = "force-dynamic";

function fail(err: unknown) {
  if (err instanceof ChecklistError) return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
  return reservationErrorResponse(err);
}

async function ownReservation(organizationId: string, id: string) {
  return prisma.reservation.findFirst({ where: { id, organizationId }, select: { id: true, status: true, returnedAt: true } });
}

// Listas vigentes (entrega y devolución) y la última revisión hecha a esta renta.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireReservationsSession("reservations.view");
  if ("response" in guard) return guard.response;
  const { id } = await ctx.params;
  try {
    if (!(await ownReservation(guard.organizationId, id))) return NextResponse.json({ ok: false, error: "Reservación no encontrada" }, { status: 404 });
    const [templates, runs] = await Promise.all([
      listTemplates(guard.organizationId, "reservation"),
      latestRuns(guard.organizationId, "reservation", id),
    ]);
    return NextResponse.json({ ok: true, templates, runs });
  } catch (err) {
    return fail(err);
  }
}

// Registra una revisión de entrega o devolución con estado, nota y foto de cada punto.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireReservationsSession("reservations.manage");
  if ("response" in guard) return guard.response;
  const { id } = await ctx.params;
  try {
    const r = await ownReservation(guard.organizationId, id);
    if (!r) return NextResponse.json({ ok: false, error: "Reservación no encontrada" }, { status: 404 });
    if (r.status === "cancelled" || r.returnedAt) return NextResponse.json({ ok: false, error: "La renta ya está cerrada" }, { status: 409 });
    const body = (await req.json().catch(() => null)) as { phase?: string; notes?: string; items?: { label?: unknown; status?: unknown; note?: unknown; photoUrl?: unknown }[] } | null;
    if (!body || !Array.isArray(body.items)) return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 });
    if (body.phase !== "delivery" && body.phase !== "return") return NextResponse.json({ ok: false, error: "Fase no válida" }, { status: 400 });
    const result = await saveRun(guard.organizationId, {
      subjectType: "reservation",
      subjectId: id,
      phase: body.phase,
      notes: body.notes ?? null,
      items: body.items.map((i) => ({ label: String(i.label ?? ""), status: String(i.status ?? ""), note: i.note ? String(i.note) : null, photoUrl: i.photoUrl ? String(i.photoUrl) : null })),
      actorUserId: guard.session.user.id,
    });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}
