import { NextResponse } from "next/server"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { prisma } from "@/lib/db"
import { evaluateWarranty } from "@/lib/warranty/server"
import { posCan, requirePosSession } from "../helpers"

export const dynamic = "force-dynamic"

// Busca un ticket por su número (el consecutivo de la sucursal) y dice qué garantías de servicio cubre hoy.
export async function GET(req: Request) {
  const guard = await requirePosSession()
  if ("response" in guard) return guard.response
  const organizationId = effectiveOrgId(guard.session)!
  const canRedeem = posCan(guard.session, "warranties.redeem")
  const params = new URL(req.url).searchParams
  const saleNumber = params.get("saleNumber")?.trim()
  // Sin número: solo dice si el dueño tiene garantías activas (el POS muestra el cuadro únicamente entonces).
  if (params.get("enabled") !== null) return NextResponse.json({ ok: true, enabled: canRedeem && (await prisma.warrantyRule.count({ where: { organizationId, isActive: true } })) > 0 })
  if (!canRedeem) return NextResponse.json({ ok: false, error: "Permiso requerido: warranties.redeem" }, { status: 403 })
  if (!saleNumber) return NextResponse.json({ ok: false, error: "Escribe el número del ticket" }, { status: 400 })
  const info = await evaluateWarranty(organizationId, { saleNumber, locationId: params.get("locationId") })
  if (!info) return NextResponse.json({ ok: false, error: "No encontramos ese ticket en esta sucursal" }, { status: 404 })
  return NextResponse.json({ ok: true, ...info })
}
