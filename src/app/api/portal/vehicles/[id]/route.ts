import { NextRequest, NextResponse } from "next/server"
import { removePortalAsset } from "@/lib/service-orders/portal"
import { ServiceOrderError } from "@/lib/service-orders/server"
import { portalErrorResponse, requirePortalCustomer } from "../../guard"

export const dynamic = "force-dynamic"

// Quita un vehículo propio (se desactiva: el historial de servicios se conserva).
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requirePortalCustomer()
  if ("response" in guard) return guard.response
  const { id } = await ctx.params
  try {
    await removePortalAsset(guard.organizationId, guard.customerId, id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ServiceOrderError) return NextResponse.json({ ok: false, error: err.message }, { status: err.status })
    return portalErrorResponse(err)
  }
}
