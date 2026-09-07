import { NextRequest, NextResponse } from "next/server";
import { agendaErrorResponse, requireAgendaSession } from "./helpers";
import {
  createAppointment,
  getAgendaAppointments,
  getAgendaStaff,
  getBookableServices,
} from "@/lib/agenda/server";

export const dynamic = "force-dynamic";

// Lista de citas en el rango [from, to) + personal con sus servicios.
export async function GET(req: NextRequest) {
  const guard = await requireAgendaSession("appointments.view");
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
    const [appointments, staff, services] = await Promise.all([
      getAgendaAppointments(organizationId, from, to),
      getAgendaStaff(organizationId),
      getBookableServices(organizationId),
    ]);
    return NextResponse.json({ ok: true, appointments, staff, services });
  } catch (err) {
    return agendaErrorResponse(err);
  }
}

// Crea una cita (pending). Valida personal → asignación → conflicto de horario.
export async function POST(req: NextRequest) {
  const guard = await requireAgendaSession("appointments.manage");
  if ("response" in guard) return guard.response;
  const { organizationId } = guard;

  try {
    const body = await req.json();
    const startsAt = new Date(body.startsAt);
    if (!body.customerId || !body.employeeId || !body.variantId || Number.isNaN(startsAt.getTime())) {
      return NextResponse.json(
        { ok: false, error: "Faltan datos: cliente, empleado, servicio y horario" },
        { status: 400 }
      );
    }
    const appointment = await createAppointment(organizationId, {
      customerId: String(body.customerId),
      employeeId: String(body.employeeId),
      variantId: String(body.variantId),
      startsAt,
      durationMin: body.durationMin ? Number(body.durationMin) : undefined,
      notes: body.notes ? String(body.notes) : null,
    });
    return NextResponse.json({ ok: true, id: appointment.id }, { status: 201 });
  } catch (err) {
    return agendaErrorResponse(err);
  }
}