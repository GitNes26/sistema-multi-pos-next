import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { AgendaError, hasTimeConflict } from "@/lib/agenda/server";
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
    const appointment = await prisma.appointment.findFirst({
      where: { id, organizationId },
    });
    if (!appointment) throw new AgendaError("Cita no encontrada", 404);

    const allowed: Record<string, boolean> = {
      pending: true,
      confirmed: true,
      cancelled: true,
      no_show: true,
    };
    if (body.status && body.status !== "completed" && !allowed[body.status as string]) {
      throw new AgendaError("Estatus inválido", 400);
    }

    let startsAt = appointment.startsAt;
    let durationMin = appointment.durationMin;
    if (body.startsAt) {
      const parsed = new Date(body.startsAt);
      if (Number.isNaN(parsed.getTime())) throw new AgendaError("Horario inválido", 400);
      startsAt = parsed;
    }
    if (body.durationMin) {
      const d = Number(body.durationMin);
      if (!d || d < 5 || d > 480) throw new AgendaError("Duración inválida (5–480 min)", 400);
      durationMin = d;
    }
    const endsAt = new Date(startsAt.getTime() + durationMin * 60000);

    if (
      startsAt.getTime() !== appointment.startsAt.getTime() ||
      durationMin !== appointment.durationMin
    ) {
      if (appointment.status === "completed") {
        throw new AgendaError("No se puede reprogramar una cita cobrada", 409);
      }
      if (await hasTimeConflict(organizationId, appointment.employeeId, startsAt, endsAt, id)) {
        throw new AgendaError("El empleado ya tiene una cita en ese horario", 409);
      }
    }

    if (body.status === "cancelled" || body.status === "no_show") {
      // Una cita cobrada no se cancela: se gestiona como devolución de venta.
      if (appointment.saleId) throw new AgendaError("La cita ya fue cobrada", 409);
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: body.status ?? appointment.status,
        startsAt,
        endsAt,
        durationMin,
        notes:
          body.notes !== undefined
            ? String(body.notes).trim()
              ? String(body.notes).trim()
              : null
            : appointment.notes,
      },
      select: { id: true, status: true, startsAt: true, endsAt: true, durationMin: true, notes: true },
    });
    return NextResponse.json({ ok: true, appointment: updated });
  } catch (err) {
    return agendaErrorResponse(err);
  }
}