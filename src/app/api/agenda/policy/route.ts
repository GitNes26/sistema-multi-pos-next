import { NextRequest, NextResponse } from "next/server"
import { getAppointmentPolicy, saveAppointmentPolicy } from "@/lib/agenda/policy"
import { agendaErrorResponse, requireAgendaSession } from "../helpers"

export const dynamic = "force-dynamic"

// Política de citas de la empresa: horario, anticipación, reagenda y tolerancia.
export async function GET() {
  const guard = await requireAgendaSession("appointments.view")
  if ("response" in guard) return guard.response
  try {
    return NextResponse.json({ ok: true, policy: await getAppointmentPolicy(guard.organizationId) })
  } catch (err) {
    return agendaErrorResponse(err)
  }
}

export async function PUT(req: NextRequest) {
  // Cambiar las reglas es de quien tiene el permiso de política de citas, no de quien solo atiende la agenda.
  const guard = await requireAgendaSession("appointments.policy")
  if ("response" in guard) return guard.response
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const policy = await saveAppointmentPolicy(guard.organizationId, body)
    return NextResponse.json({ ok: true, policy })
  } catch (err) {
    return agendaErrorResponse(err)
  }
}
