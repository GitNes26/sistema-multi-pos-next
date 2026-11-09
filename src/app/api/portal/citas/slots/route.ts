import { NextRequest, NextResponse } from "next/server"
import { getPortalSlots } from "@/lib/agenda/portal"
import { requirePortalCustomer } from "../../guard"
import { citasFail } from "../fail"

export const dynamic = "force-dynamic"

// Horarios libres de un día para el servicio (y persona/lugar si los eligió).
export async function GET(req: NextRequest) {
  const guard = await requirePortalCustomer()
  if ("response" in guard) return guard.response
  try {
    const p = req.nextUrl.searchParams
    const variantId = p.get("variantId")
    const date = p.get("date")
    if (!variantId || !date) return NextResponse.json({ ok: false, error: "Faltan servicio y fecha" }, { status: 400 })
    const slots = await getPortalSlots(guard.organizationId, { variantId, date, employeeId: p.get("employeeId") || null, stationId: p.get("stationId") || null })
    return NextResponse.json({ ok: true, slots })
  } catch (err) {
    return citasFail(err)
  }
}
