import { NextRequest, NextResponse } from "next/server"
import { cancelServiceOrder, getServiceOrder, getServiceOrderHistory, updateServiceOrder } from "@/lib/service-orders/server"
import { ordersErrorResponse, requireOrdersSession } from "../helpers"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireOrdersSession("service_orders.view")
  if ("response" in guard) return guard.response
  const { id } = await ctx.params
  try {
    const [order, events] = await Promise.all([getServiceOrder(guard.organizationId, id), getServiceOrderHistory(guard.organizationId, id)])
    return NextResponse.json({ ok: true, order, events })
  } catch (err) {
    return ordersErrorResponse(err)
  }
}

// Mover de etapa, asignar lugar, responsable o llavero, editar indicaciones o cancelar.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireOrdersSession("service_orders.manage")
  if ("response" in guard) return guard.response
  const { id } = await ctx.params
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    if (body.cancel === true) {
      await cancelServiceOrder(guard.organizationId, id, { reason: body.reason ? String(body.reason) : null, actorUserId: guard.session.user.id })
      return NextResponse.json({ ok: true })
    }
    const promised = body.promisedAt === undefined ? undefined : body.promisedAt ? new Date(String(body.promisedAt)) : null
    if (promised && Number.isNaN(promised.getTime())) return NextResponse.json({ ok: false, error: "Hora prometida inválida" }, { status: 400 })
    const order = await updateServiceOrder(guard.organizationId, id, {
      stageId: body.stageId ? String(body.stageId) : undefined,
      stationId: body.stationId === undefined ? undefined : body.stationId ? String(body.stationId) : null,
      employeeId: body.employeeId === undefined ? undefined : body.employeeId ? String(body.employeeId) : null,
      keyTag: body.keyTag === undefined ? undefined : body.keyTag ? String(body.keyTag) : null,
      indications: body.indications === undefined ? undefined : body.indications ? String(body.indications) : null,
      promisedAt: promised,
      actorUserId: guard.session.user.id,
    })
    return NextResponse.json({ ok: true, order })
  } catch (err) {
    return ordersErrorResponse(err)
  }
}
