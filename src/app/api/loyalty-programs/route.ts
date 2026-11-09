import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { listLoyaltyPrograms, saveLoyaltyProgram } from "@/lib/loyalty/server"
import { loyaltyFail, requireLoyaltyAdmin } from "./guard"

export const dynamic = "force-dynamic"

// Programas de fidelidad de la empresa + productos/servicios para elegir a qué aplican.
export async function GET() {
  const guard = await requireLoyaltyAdmin("loyalty.view")
  if ("response" in guard) return guard.response
  try {
    const [programs, products] = await Promise.all([
      listLoyaltyPrograms(guard.organizationId),
      prisma.product.findMany({ where: { organizationId: guard.organizationId, isActive: true }, select: { id: true, name: true, trackInventory: true }, orderBy: { name: "asc" }, take: 500 }),
    ])
    return NextResponse.json({ ok: true, programs, products })
  } catch (err) {
    return loyaltyFail(err)
  }
}

// Activa una opción (elegida de las precargadas y ajustada) como programa de la empresa.
export async function POST(req: Request) {
  const guard = await requireLoyaltyAdmin("loyalty.manage")
  if ("response" in guard) return guard.response
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const program = await saveLoyaltyProgram(guard.organizationId, body)
    return NextResponse.json({ ok: true, id: program.id }, { status: 201 })
  } catch (err) {
    return loyaltyFail(err)
  }
}
