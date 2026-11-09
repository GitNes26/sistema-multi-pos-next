import { NextResponse } from "next/server"
import { saveLoyaltyProgram } from "@/lib/loyalty/server"
import { loyaltyFail, requireLoyaltyAdmin } from "../guard"

export const dynamic = "force-dynamic"

// Edita un programa o lo activa/desactiva (los créditos de los clientes se conservan).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireLoyaltyAdmin("loyalty.manage")
  if ("response" in guard) return guard.response
  try {
    const { id } = await ctx.params
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    await saveLoyaltyProgram(guard.organizationId, body, id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return loyaltyFail(err)
  }
}
