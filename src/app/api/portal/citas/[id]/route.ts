import { NextResponse } from "next/server"
import { cancelPortalAppointment } from "@/lib/agenda/portal"
import { requirePortalCustomer } from "../../guard"
import { citasFail } from "../fail"

export const dynamic = "force-dynamic"

// Cancela una cita propia que aún no empieza.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requirePortalCustomer()
  if ("response" in guard) return guard.response
  try {
    const { id } = await ctx.params
    await cancelPortalAppointment(guard.organizationId, guard.customerId, guard.userId, id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return citasFail(err)
  }
}
