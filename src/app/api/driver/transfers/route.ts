import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { hasPermission } from "@/lib/auth/permissions"
import { prisma } from "@/lib/db"
import { acceptTransfer, dispatchTransfer, listDriverTransfers, recordTransferLocation } from "@/lib/inventory/transfers"

export const dynamic = "force-dynamic"

async function driverSession() {
  const session = await getServerSession(authOptions)
  const organizationId = effectiveOrgId(session)
  if (!session?.user || session.user.scope === "portal" || !organizationId) return null
  if (!hasPermission(session, "delivery.manage")) return null
  const employee = await prisma.employee.findFirst({ where: { userId: session.user.id, organizationId }, select: { id: true, fullName: true } })
  return { userId: session.user.id, organizationId, employee }
}

const fail = (err: unknown) => {
  const status = err && typeof err === "object" && "status" in err ? Number((err as { status: unknown }).status) : 500
  return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Error" }, { status })
}

// GET — traslados del chofer: los asignados a él y los que aún no tienen chofer.
export async function GET() {
  const ctx = await driverSession()
  if (!ctx) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 })
  try {
    return NextResponse.json({ ok: true, myEmployeeId: ctx.employee?.id ?? null, rows: await listDriverTransfers(ctx.organizationId, ctx.employee?.id ?? null) })
  } catch (err) {
    return fail(err)
  }
}

// POST { id, action: "accept" | "depart" | "location", lat?, lng? }
export async function POST(req: Request) {
  const ctx = await driverSession()
  if (!ctx) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 })
  if (!ctx.employee) return NextResponse.json({ ok: false, error: "Tu usuario no tiene un empleado vinculado para llevar traslados" }, { status: 409 })
  const body = (await req.json().catch(() => ({}))) as { id?: string; action?: string; lat?: number; lng?: number; accuracy?: number }
  if (!body.id) return NextResponse.json({ ok: false, error: "Falta el traslado" }, { status: 400 })
  try {
    const t = await prisma.transfer.findFirst({ where: { id: body.id, organizationId: ctx.organizationId }, select: { driverEmployeeId: true } })
    if (!t) return NextResponse.json({ ok: false, error: "Traslado no encontrado" }, { status: 404 })
    if (body.action === "accept") return NextResponse.json(await acceptTransfer(ctx.organizationId, body.id, ctx.employee.id))
    // Salir y compartir ubicación solo lo hace el chofer asignado.
    if (t.driverEmployeeId !== ctx.employee.id) return NextResponse.json({ ok: false, error: "Primero acepta el traslado" }, { status: 403 })
    if (body.action === "depart") return NextResponse.json(await dispatchTransfer(ctx.organizationId, body.id, ctx.userId, { driverName: ctx.employee.fullName }))
    if (body.action === "location" && typeof body.lat === "number" && typeof body.lng === "number") {
      return NextResponse.json(await recordTransferLocation(ctx.organizationId, body.id, { lat: body.lat, lng: body.lng, accuracy: body.accuracy ?? null }))
    }
    return NextResponse.json({ ok: false, error: "Acción desconocida" }, { status: 400 })
  } catch (err) {
    return fail(err)
  }
}
