import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth/options"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { hasPermission } from "@/lib/auth/permissions"
import { LoyaltyError } from "@/lib/loyalty/server"

/** Sesión de administración con el permiso pedido (rol ∩ plan) y la empresa efectiva. */
export async function requireLoyaltyAdmin(permission: "loyalty.view" | "loyalty.manage" | "warranties.view" | "warranties.manage") {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { response: NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 }) }
  const organizationId = effectiveOrgId(session)
  if (session.user.scope === "portal" || !organizationId) return { response: NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 }) }
  if (!hasPermission(session, permission)) return { response: NextResponse.json({ ok: false, error: `Permiso requerido: ${permission}` }, { status: 403 }) }
  return { organizationId }
}

export function loyaltyFail(err: unknown) {
  if (err instanceof LoyaltyError) return NextResponse.json({ ok: false, error: err.message, field: err.field }, { status: err.status })
  console.error("[loyalty]", err)
  return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 })
}
