import { NextRequest, NextResponse } from "next/server"
import { createServiceOrder, listFlows, listServiceOrders } from "@/lib/service-orders/server"
import { ordersErrorResponse, requireOrdersSession } from "./helpers"

export const dynamic = "force-dynamic"

// Tablero: órdenes abiertas/listas (y las entregadas del último día) + flujos con sus etapas.
export async function GET(req: NextRequest) {
  const guard = await requireOrdersSession("service_orders.view")
  if ("response" in guard) return guard.response
  try {
    const flowId = req.nextUrl.searchParams.get("flowId")
    const [orders, flows] = await Promise.all([listServiceOrders(guard.organizationId, { flowId }), listFlows(guard.organizationId)])
    return NextResponse.json({ ok: true, orders, flows })
  } catch (err) {
    return ordersErrorResponse(err)
  }
}

// Recibe un vehículo u objeto: crea la orden en la primera etapa de su flujo.
export async function POST(req: NextRequest) {
  const guard = await requireOrdersSession("service_orders.manage")
  if ("response" in guard) return guard.response
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || !Array.isArray(body.items)) return NextResponse.json({ ok: false, error: "Elige al menos un servicio" }, { status: 400 })
    const promised = body.promisedAt ? new Date(String(body.promisedAt)) : null
    if (promised && Number.isNaN(promised.getTime())) return NextResponse.json({ ok: false, error: "Hora prometida inválida" }, { status: 400 })
    const order = await createServiceOrder(guard.organizationId, {
      customerId: body.customerId ? String(body.customerId) : null,
      assetId: body.assetId ? String(body.assetId) : null,
      stationId: body.stationId ? String(body.stationId) : null,
      employeeId: body.employeeId ? String(body.employeeId) : null,
      keyTag: body.keyTag ? String(body.keyTag) : null,
      indications: body.indications ? String(body.indications) : null,
      promisedAt: promised,
      items: (body.items as { variantId?: unknown; quantity?: unknown }[]).map((i) => ({ variantId: String(i.variantId ?? ""), quantity: Number(i.quantity) || 1 })),
      actorUserId: guard.session.user.id,
    })
    return NextResponse.json({ ok: true, order }, { status: 201 })
  } catch (err) {
    return ordersErrorResponse(err)
  }
}
