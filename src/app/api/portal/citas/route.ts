import { NextRequest, NextResponse } from "next/server"
import { bookPortalAppointment, getPortalBooking } from "@/lib/agenda/portal"
import { requirePortalCustomer } from "../guard"
import { citasFail } from "./fail"

export const dynamic = "force-dynamic"

// Servicios, personal, lugares y mis citas.
export async function GET() {
  const guard = await requirePortalCustomer()
  if ("response" in guard) return guard.response
  try {
    return NextResponse.json({ ok: true, ...(await getPortalBooking(guard.organizationId, guard.customerId)) })
  } catch (err) {
    return citasFail(err)
  }
}

// Agenda una cita (personal y lugar opcionales).
export async function POST(req: NextRequest) {
  const guard = await requirePortalCustomer()
  if ("response" in guard) return guard.response
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const startsAt = new Date(String(body.startsAt ?? ""))
    if (!body.variantId) return NextResponse.json({ ok: false, error: "Elige el servicio" }, { status: 400 })
    const result = await bookPortalAppointment(guard.organizationId, guard.customerId, guard.userId, {
      variantId: String(body.variantId),
      employeeId: body.employeeId ? String(body.employeeId) : null,
      stationId: body.stationId ? String(body.stationId) : null,
      startsAt,
      notes: body.notes ? String(body.notes) : null,
    })
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (err) {
    return citasFail(err)
  }
}
