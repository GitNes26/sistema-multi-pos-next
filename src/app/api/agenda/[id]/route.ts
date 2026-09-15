import { NextRequest, NextResponse } from "next/server";
import { updateAppointment } from "@/lib/agenda/server";
import { agendaErrorResponse, requireAgendaSession } from "../helpers";

export const dynamic = "force-dynamic";

// Actualiza una cita: estatus (pending/confirmed/cancelled/no_show), horario,
// duración o notas. "completed" solo llega por el checkout (liga la venta).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAgendaSession("appointments.manage");
  if ("response" in guard) return guard.response;
  const { organizationId } = guard;
  const { id } = await ctx.params;

  try {
    const body = await req.json();
    const allowed = ["pending", "confirmed", "cancelled", "no_show", "completed"];
    if (body.status && !allowed.includes(String(body.status))) {
      return NextResponse.json({ ok: false, error: "Estatus inválido" }, { status: 400 });
    }
    const updated = await updateAppointment(organizationId, id, {
      status: body.status,
      startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
      durationMin: body.durationMin !== undefined ? Number(body.durationMin) : undefined,
      notes: body.notes !== undefined ? String(body.notes) : undefined,
    });
    return NextResponse.json({ ok: true, appointment: updated });
  } catch (err) {
    return agendaErrorResponse(err);
  }
}
