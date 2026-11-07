import { NextRequest, NextResponse } from "next/server"
import { checkInAppointment } from "@/lib/agenda/server"
import { agendaErrorResponse, overrideFromBody, requireAgendaSession } from "../../helpers"

export const dynamic = "force-dynamic"

// «Llegó»: registra la llegada del cliente dentro de la tolerancia. Fuera de ella solo con motivo.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAgendaSession("appointments.checkin")
  if ("response" in guard) return guard.response
  const { id } = await ctx.params
  try {
    const body = (await req.json().catch(() => ({}))) as { overrideReason?: string }
    const result = await checkInAppointment(guard.organizationId, id, {
      actorUserId: guard.session.user.id,
      override: overrideFromBody(guard.session, body),
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return agendaErrorResponse(err)
  }
}
