import { NextResponse } from "next/server"
import { requirePosSession } from "../../helpers"
import { getOrderDetail } from "@/lib/orders/server"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePosSession()
  if ("response" in guard) return guard.response
  const { session } = guard

  const { id } = await params
  const organizationId = session.user.activeOrganizationId ?? session.user.organizationId
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Sin organización" }, { status: 400 })
  }

  try {
    const order = await getOrderDetail(organizationId, id)
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado" }, { status: 404 })
    }
    return NextResponse.json({ ok: true, order })
  } catch (err) {
    console.error("[pos/orders/[id]]", err)
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 })
  }
}
