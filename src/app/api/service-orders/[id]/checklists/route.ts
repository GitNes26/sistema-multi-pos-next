import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { ChecklistError, latestRuns, listTemplates, PHASE_LABEL, saveRun, type Phase } from "@/lib/checklists/server"
import { getServiceOrder } from "@/lib/service-orders/server"
import { ordersErrorResponse, requireOrdersSession } from "../../helpers"

export const dynamic = "force-dynamic"

function fail(err: unknown) {
  if (err instanceof ChecklistError) return NextResponse.json({ ok: false, error: err.message }, { status: err.status })
  return ordersErrorResponse(err)
}

// Lista vigente de cada fase y la última revisión hecha a esta orden.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireOrdersSession("service_orders.view")
  if ("response" in guard) return guard.response
  const { id } = await ctx.params
  try {
    await getServiceOrder(guard.organizationId, id)
    const [templates, runs] = await Promise.all([listTemplates(guard.organizationId, "service_order"), latestRuns(guard.organizationId, "service_order", id)])
    return NextResponse.json({ ok: true, templates, runs })
  } catch (err) {
    return fail(err)
  }
}

// Registra una revisión (ingreso o entrega) con el estado, nota y foto de cada punto.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireOrdersSession("service_orders.manage")
  if ("response" in guard) return guard.response
  const { id } = await ctx.params
  try {
    const order = await getServiceOrder(guard.organizationId, id)
    if (order.status === "delivered" || order.status === "cancelled") return NextResponse.json({ ok: false, error: "La orden ya está cerrada" }, { status: 409 })
    const body = (await req.json().catch(() => null)) as { phase?: string; notes?: string; items?: { label?: unknown; status?: unknown; note?: unknown; photoUrl?: unknown }[] } | null
    if (!body || !Array.isArray(body.items)) return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 })
    const result = await saveRun(guard.organizationId, {
      subjectType: "service_order",
      subjectId: id,
      phase: String(body.phase ?? ""),
      notes: body.notes ?? null,
      items: body.items.map((i) => ({ label: String(i.label ?? ""), status: String(i.status ?? ""), note: i.note ? String(i.note) : null, photoUrl: i.photoUrl ? String(i.photoUrl) : null })),
      actorUserId: guard.session.user.id,
    })
    const phase = String(body.phase) as Phase
    await prisma.serviceOrderEvent.create({
      data: {
        organizationId: guard.organizationId,
        orderId: id,
        type: "note",
        detail: `Revisión de ${PHASE_LABEL[phase] ?? phase}: ${result.issues ? `${result.issues} ${result.issues === 1 ? "problema" : "problemas"} registrado${result.issues === 1 ? "" : "s"}` : "sin problemas"}`,
        actorUserId: guard.session.user.id,
      },
    })
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (err) {
    return fail(err)
  }
}
