import { NextRequest, NextResponse } from "next/server";
import { syncEmployeeServices } from "@/lib/agenda/server";
import { agendaErrorResponse, requireAgendaSession } from "../helpers";

export const dynamic = "force-dynamic";

// Reemplaza las asignaciones (servicio + duración) del personal indicado.
// Body: { assignments: [{ employeeId, variantId, durationMin, isActive }] }
export async function POST(req: NextRequest) {
  const guard = await requireAgendaSession("appointments.manage");
  if ("response" in guard) return guard.response;
  const { organizationId } = guard;

  try {
    const body = await req.json();
    if (!Array.isArray(body.assignments) || body.assignments.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Se requiere al menos una asignación" },
        { status: 400 }
      );
    }
    const assignments = body.assignments.map((a: Record<string, unknown>) => ({
      employeeId: String(a.employeeId),
      variantId: String(a.variantId),
      durationMin: Number(a.durationMin),
      isActive: a.isActive !== false,
    }));
    const result = await syncEmployeeServices(organizationId, assignments);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return agendaErrorResponse(err);
  }
}