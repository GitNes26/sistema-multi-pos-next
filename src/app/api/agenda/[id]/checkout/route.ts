import { NextRequest, NextResponse } from "next/server";
import type { $Enums } from "@prisma/client";
import { checkoutAppointment } from "@/lib/agenda/server";
import {
  agendaErrorResponse,
  requireAgendaSession,
  resolveAgendaEmployeeId,
} from "../../helpers";

export const dynamic = "force-dynamic";

const METHODS: $Enums.PaymentMethod[] = ["cash", "card", "wallet", "other"];

// Cobra la cita: crea la venta del servicio, la liga (saleId) y la marca
// como completada. Permiso: appointments.manage (el operador de la agenda).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAgendaSession("appointments.manage");
  if ("response" in guard) return guard.response;
  const { organizationId, session } = guard;
  const { id } = await ctx.params;

  try {
    const body = await req.json().catch(() => ({}));
    const method = (body.method ?? "cash") as $Enums.PaymentMethod;
    if (!METHODS.includes(method)) {
      return NextResponse.json({ ok: false, error: "Método de pago inválido" }, { status: 400 });
    }
    const employeeId = await resolveAgendaEmployeeId(session.user.id, organizationId);
    const result = await checkoutAppointment(organizationId, id, method, {
      userId: session.user.id,
      employeeId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return agendaErrorResponse(err);
  }
}