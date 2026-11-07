import { NextRequest, NextResponse } from "next/server"
import { ChecklistError, listTemplates, saveTemplate } from "@/lib/checklists/server"
import { ordersErrorResponse, requireOrdersSession } from "../helpers"

export const dynamic = "force-dynamic"

function fail(err: unknown) {
  if (err instanceof ChecklistError) return NextResponse.json({ ok: false, error: err.message }, { status: err.status })
  return ordersErrorResponse(err)
}

// Listas de revisión de las órdenes de servicio (ingreso y entrega).
export async function GET() {
  const guard = await requireOrdersSession("service_orders.view")
  if ("response" in guard) return guard.response
  try {
    return NextResponse.json({ ok: true, templates: await listTemplates(guard.organizationId, "service_order") })
  } catch (err) {
    return fail(err)
  }
}

// Crea, reemplaza o quita (sin puntos) la lista de una fase.
export async function PUT(req: NextRequest) {
  const guard = await requireOrdersSession("service_flows.manage")
  if ("response" in guard) return guard.response
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 })
    const items = Array.isArray(body.items) ? (body.items as { label?: unknown; requirePhoto?: unknown }[]).map((i) => ({ label: String(i.label ?? ""), requirePhoto: i.requirePhoto !== false })) : []
    const template = await saveTemplate(guard.organizationId, {
      subjectType: "service_order",
      phase: String(body.phase ?? ""),
      name: body.name ? String(body.name) : undefined,
      isRequired: body.isRequired === true,
      items,
    })
    return NextResponse.json({ ok: true, template })
  } catch (err) {
    return fail(err)
  }
}
