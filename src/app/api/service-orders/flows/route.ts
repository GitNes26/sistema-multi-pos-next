import { NextRequest, NextResponse } from "next/server"
import { listFlows, saveFlow } from "@/lib/service-orders/server"
import { ordersErrorResponse, requireOrdersSession } from "../helpers"

export const dynamic = "force-dynamic"

export async function GET() {
  const guard = await requireOrdersSession("service_orders.view")
  if ("response" in guard) return guard.response
  try {
    return NextResponse.json({ ok: true, flows: await listFlows(guard.organizationId) })
  } catch (err) {
    return ordersErrorResponse(err)
  }
}

// Crea o actualiza un flujo (etapas en orden + servicios que lo usan).
export async function PUT(req: NextRequest) {
  const guard = await requireOrdersSession("service_flows.manage")
  if ("response" in guard) return guard.response
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 })
    const stages = Array.isArray(body.stages) ? (body.stages as { id?: string; label?: string; notifyCustomer?: boolean; isReady?: boolean }[]) : []
    const flow = await saveFlow(guard.organizationId, {
      id: body.id ? String(body.id) : undefined,
      name: String(body.name ?? ""),
      description: body.description ? String(body.description) : null,
      isDefault: body.isDefault === true,
      stages: stages.map((s) => ({ id: s.id, label: String(s.label ?? ""), notifyCustomer: s.notifyCustomer === true, isReady: s.isReady === true })),
      productIds: Array.isArray(body.productIds) ? (body.productIds as unknown[]).map(String) : [],
    })
    return NextResponse.json({ ok: true, flow })
  } catch (err) {
    return ordersErrorResponse(err)
  }
}
