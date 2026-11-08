import { NextRequest, NextResponse } from "next/server"
import { hasPermission } from "@/lib/auth/permissions"
import { ServiceOrderError, startOrderFromAppointment } from "@/lib/service-orders/server"
import { agendaErrorResponse, requireAgendaSession } from "../../helpers"

export const dynamic = "force-dynamic"

// Convierte una cita con «Llegó» en orden de servicio (silla, empleado, ficha de estilo e indicaciones).
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAgendaSession("appointments.checkin")
  if ("response" in guard) return guard.response
  if (!hasPermission(guard.session, "service_orders.manage")) {
    return NextResponse.json({ ok: false, error: "Permiso requerido: service_orders.manage" }, { status: 403 })
  }
  const { id } = await ctx.params
  try {
    const order = await startOrderFromAppointment(guard.organizationId, id, guard.session.user.id)
    return NextResponse.json({ ok: true, orderId: order.id, number: order.number })
  } catch (err) {
    if (err instanceof ServiceOrderError) return NextResponse.json({ ok: false, error: err.message }, { status: err.status })
    return agendaErrorResponse(err)
  }
}
