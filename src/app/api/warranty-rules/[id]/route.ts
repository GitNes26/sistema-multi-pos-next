import { NextResponse } from "next/server"
import { saveWarrantyRule } from "@/lib/warranty/server"
import { requireLoyaltyAdmin } from "../../loyalty-programs/guard"
import { warrantyFail } from "../fail"

export const dynamic = "force-dynamic"

// Edita una garantía o la activa/pausa (lo ya canjeado se conserva).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireLoyaltyAdmin("warranties.manage")
  if ("response" in guard) return guard.response
  try {
    const { id } = await ctx.params
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    await saveWarrantyRule(guard.organizationId, body, id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return warrantyFail(err)
  }
}
