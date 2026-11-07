import { NextRequest, NextResponse } from "next/server"
import type { $Enums } from "@prisma/client"
import { prisma } from "@/lib/db"
import { checkoutServiceOrder } from "@/lib/service-orders/server"
import { ordersErrorResponse, requireOrdersSession } from "../../helpers"

export const dynamic = "force-dynamic"

const METHODS: $Enums.PaymentMethod[] = ["cash", "card", "wallet", "other"]

// Cobra la orden lista: crea la venta, la liga a la orden y la marca como entregada.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireOrdersSession("service_orders.manage")
  if ("response" in guard) return guard.response
  const { id } = await ctx.params
  try {
    const body = (await req.json().catch(() => ({}))) as { method?: string }
    const method = (body.method ?? "cash") as $Enums.PaymentMethod
    if (!METHODS.includes(method)) return NextResponse.json({ ok: false, error: "Método de pago inválido" }, { status: 400 })
    const employee = await prisma.employee.findFirst({ where: { organizationId: guard.organizationId, userId: guard.session.user.id }, select: { id: true } })
    const result = await checkoutServiceOrder(guard.organizationId, id, method, { userId: guard.session.user.id, employeeId: employee?.id ?? null })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return ordersErrorResponse(err)
  }
}
