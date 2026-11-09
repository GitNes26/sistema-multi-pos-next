import { NextResponse } from "next/server"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { getCustomerLoyalty, LoyaltyError } from "@/lib/loyalty/server"
import { posCan, requirePosSession } from "../helpers"

export const dynamic = "force-dynamic"

// Créditos y avance de fidelidad de un cliente (el POS propone el canje; el servidor lo valida al cobrar).
export async function GET(req: Request) {
  const guard = await requirePosSession()
  if ("response" in guard) return guard.response
  const organizationId = effectiveOrgId(guard.session)!
  const customerId = new URL(req.url).searchParams.get("customerId")
  if (!customerId) return NextResponse.json({ ok: false, error: "Falta el cliente" }, { status: 400 })
  // Sin el permiso de canje el cajero no ve créditos para canjear.
  if (!posCan(guard.session, "loyalty.redeem")) return NextResponse.json({ ok: true, programs: [] })
  try {
    return NextResponse.json({ ok: true, programs: await getCustomerLoyalty(organizationId, customerId) })
  } catch (err) {
    if (err instanceof LoyaltyError) return NextResponse.json({ ok: false, error: err.message }, { status: err.status })
    throw err
  }
}
