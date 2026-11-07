import { NextRequest, NextResponse } from "next/server"
import { createPortalAsset, listPortalAssets, listPortalOrders } from "@/lib/service-orders/portal"
import { ServiceOrderError } from "@/lib/service-orders/server"
import { portalErrorResponse, requirePortalCustomer } from "../guard"

export const dynamic = "force-dynamic"

function fail(err: unknown) {
  if (err instanceof ServiceOrderError) return NextResponse.json({ ok: false, error: err.message }, { status: err.status })
  return portalErrorResponse(err)
}

// Mis vehículos y mis servicios (órdenes) en este negocio.
export async function GET() {
  const guard = await requirePortalCustomer()
  if ("response" in guard) return guard.response
  try {
    const [assets, orders] = await Promise.all([listPortalAssets(guard.organizationId, guard.customerId), listPortalOrders(guard.organizationId, guard.customerId)])
    return NextResponse.json({ ok: true, assets, orders })
  } catch (err) {
    return fail(err)
  }
}

// Registra un vehículo propio (el negocio lo ve al recibirlo).
export async function POST(req: NextRequest) {
  const guard = await requirePortalCustomer()
  if ("response" in guard) return guard.response
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const asset = await createPortalAsset(guard.organizationId, guard.customerId, body)
    return NextResponse.json({ ok: true, asset }, { status: 201 })
  } catch (err) {
    return fail(err)
  }
}
