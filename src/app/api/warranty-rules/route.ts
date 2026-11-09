import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { listWarrantyRules, saveWarrantyRule, warrantiesAvailable } from "@/lib/warranty/server"
import { requireLoyaltyAdmin } from "../loyalty-programs/guard"
import { warrantyFail } from "./fail"

export const dynamic = "force-dynamic"

// Reglas de garantía de la empresa + servicios (productos sin inventario) para elegir a cuáles aplican.
export async function GET() {
  const guard = await requireLoyaltyAdmin("warranties.view")
  if ("response" in guard) return guard.response
  try {
    const [rules, products] = await Promise.all([
      listWarrantyRules(guard.organizationId),
      prisma.product.findMany({ where: { organizationId: guard.organizationId, isActive: true, trackInventory: false }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
    ])
    return NextResponse.json({ ok: true, rules, products, available: await warrantiesAvailable(guard.organizationId) })
  } catch (err) {
    return warrantyFail(err)
  }
}

// Activa una garantía (opción precargada ajustada por el dueño).
export async function POST(req: Request) {
  const guard = await requireLoyaltyAdmin("warranties.manage")
  if ("response" in guard) return guard.response
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const rule = await saveWarrantyRule(guard.organizationId, body)
    return NextResponse.json({ ok: true, id: rule.id }, { status: 201 })
  } catch (err) {
    return warrantyFail(err)
  }
}
