import { getServerSession } from "next-auth"
import type { Session } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth/options"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { hasPermission } from "@/lib/auth/permissions"
import type { PermissionKey } from "@/lib/auth/permission-keys"
import { prisma } from "@/lib/db"
import { SERVICE_ORDER_MODES, ServiceOrderError } from "@/lib/service-orders/server"

/** Guard de las órdenes de servicio: sesión de app, empresa activa, modo con órdenes y permiso. */
export async function requireOrdersSession(
  permission: PermissionKey = "service_orders.view"
): Promise<{ session: Session; organizationId: string } | { response: NextResponse }> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { response: NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 }) }
  const organizationId = effectiveOrgId(session)
  if (!organizationId || session.user.scope === "portal") return { response: NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 }) }
  if (!hasPermission(session, "service_orders.view") || (permission !== "service_orders.view" && !hasPermission(session, permission))) {
    return { response: NextResponse.json({ ok: false, error: `Permiso requerido: ${permission}` }, { status: 403 }) }
  }
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { businessMode: true } })
  if (!org) return { response: NextResponse.json({ ok: false, error: "Organización no encontrada" }, { status: 404 }) }
  if (!SERVICE_ORDER_MODES.includes(org.businessMode)) {
    return { response: NextResponse.json({ ok: false, error: "Las órdenes de servicio no aplican a tu tipo de negocio" }, { status: 403 }) }
  }
  return { session, organizationId }
}

export function ordersErrorResponse(err: unknown): NextResponse {
  if (err instanceof ServiceOrderError) return NextResponse.json({ ok: false, error: err.message }, { status: err.status })
  console.error("[service-orders]", err)
  return NextResponse.json({ ok: false, error: "Error interno" }, { status: 500 })
}
