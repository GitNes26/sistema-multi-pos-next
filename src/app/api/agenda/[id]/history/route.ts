import { NextResponse } from "next/server"
import { getAppointmentHistory } from "@/lib/agenda/policy"
import { agendaErrorResponse, requireAgendaSession } from "../../helpers"

export const dynamic = "force-dynamic"

// Historial de la cita: alta, reagendas, llegada, cambios de estado y pérdida por tolerancia.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAgendaSession("appointments.view")
  if ("response" in guard) return guard.response
  const { id } = await ctx.params
  try {
    return NextResponse.json({ ok: true, events: await getAppointmentHistory(guard.organizationId, id) })
  } catch (err) {
    return agendaErrorResponse(err)
  }
}
