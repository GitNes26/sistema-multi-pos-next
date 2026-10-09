import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { assertPermission, PermissionDeniedError } from "@/lib/auth/server-permissions"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { requirePosSession } from "../../helpers"

export const dynamic = "force-dynamic"

// DELETE /api/pos/kitchen/cart?tableId= — vacía el carrito QR de la mesa (el personal ya lo
// pasó al ticket del POS o lo descartó).
export async function DELETE(req: Request) {
  const guard = await requirePosSession()
  if ("response" in guard) return guard.response
  const organizationId = effectiveOrgId(guard.session)!
  try {
    assertPermission(guard.session, "orders.manage")
    const tableId = new URL(req.url).searchParams.get("tableId")
    if (!tableId) return NextResponse.json({ ok: false, error: "Falta tableId" }, { status: 400 })
    await prisma.tableCart.deleteMany({ where: { tableId, organizationId } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof PermissionDeniedError) return NextResponse.json({ ok: false, error: err.message }, { status: 403 })
    console.error("[pos/kitchen/cart]", err)
    return NextResponse.json({ ok: false, error: "No se pudo vaciar el carrito" }, { status: 500 })
  }
}
