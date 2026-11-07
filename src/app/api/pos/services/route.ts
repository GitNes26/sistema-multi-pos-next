import { NextResponse } from "next/server"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { hasPermission } from "@/lib/auth/permissions"
import { invalidateOrg } from "@/lib/cache"
import { broadcastCatalogChange } from "@/lib/catalog/live"
import { prisma } from "@/lib/db"
import { requirePosSession } from "../helpers"

// Servicios = productos estándar sin control de inventario. Desde el modal del producto
// (admin) se pausan y reanudan al instante: el cambio llega a todas las cajas y a la tienda del portal.

export const dynamic = "force-dynamic"

const denied = () => NextResponse.json({ ok: false, error: "Permiso requerido: pos.toggle_services" }, { status: 403 })

export async function PATCH(req: Request) {
  const guard = await requirePosSession()
  if ("response" in guard) return guard.response
  const { session } = guard
  if (!hasPermission(session as never, "pos.toggle_services")) return denied()
  const organizationId = effectiveOrgId(session)!

  const body = (await req.json().catch(() => null)) as { productId?: unknown; isAvailable?: unknown } | null
  const productId = typeof body?.productId === "string" ? body.productId : ""
  if (!productId || typeof body?.isAvailable !== "boolean") return NextResponse.json({ ok: false, error: "Datos inválidos" }, { status: 400 })
  const isAvailable = body.isAvailable

  // Solo servicios de la empresa activa: nunca un producto con inventario ni de otra empresa.
  const updated = await prisma.product.updateMany({
    where: { id: productId, organizationId, isActive: true, productType: "standard", trackInventory: false },
    data: { isAvailable },
  })
  if (updated.count !== 1) return NextResponse.json({ ok: false, error: "Servicio no encontrado" }, { status: 404 })

  invalidateOrg(organizationId)
  broadcastCatalogChange(organizationId, { type: "availability", productId, isAvailable })
  return NextResponse.json({ ok: true, productId, isAvailable })
}
