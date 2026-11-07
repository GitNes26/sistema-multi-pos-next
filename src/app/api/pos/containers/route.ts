import { NextResponse } from "next/server"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { DepositError, getContainerBalances, refundContainers } from "@/lib/deposits/server"
import { requirePosSession } from "../helpers"

// Envases con importe: saldo en circulación de la sucursal y devolución (el importe sale en efectivo de la caja).

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const guard = await requirePosSession()
  if ("response" in guard) return guard.response
  const organizationId = effectiveOrgId(guard.session)!
  const locationId = new URL(req.url).searchParams.get("locationId") ?? ""
  if (!locationId) return NextResponse.json({ ok: false, error: "Falta la sucursal" }, { status: 400 })
  return NextResponse.json({ ok: true, balances: await getContainerBalances(organizationId, locationId) })
}

export async function POST(req: Request) {
  const guard = await requirePosSession()
  if ("response" in guard) return guard.response
  const { session } = guard
  const organizationId = effectiveOrgId(session)!
  const body = (await req.json().catch(() => null)) as { locationId?: unknown; productId?: unknown; quantity?: unknown; customerId?: unknown } | null
  const locationId = typeof body?.locationId === "string" ? body.locationId : ""
  const productId = typeof body?.productId === "string" ? body.productId : ""
  const quantity = Number(body?.quantity)
  if (!locationId || !productId) return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 })
  try {
    const result = await refundContainers(
      organizationId,
      locationId,
      { productId, quantity, customerId: typeof body?.customerId === "string" ? body.customerId : null },
      { userId: session.user.id }
    )
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof DepositError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status })
    console.error("[pos/containers]", error)
    return NextResponse.json({ ok: false, error: "No se pudo registrar la devolución" }, { status: 500 })
  }
}
