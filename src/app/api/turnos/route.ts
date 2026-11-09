import { NextResponse } from "next/server"
import { getTurnsBoard } from "@/lib/service-orders/turns"
import { ordersErrorResponse, requireOrdersSession } from "../service-orders/helpers"

// Tablero de turnos para la pantalla de la clientela. Solo giros con órdenes de servicio y permiso de verlas;
// la empresa sale de la sesión (nunca de la petición). La sucursal es un filtro opcional.
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const guard = await requireOrdersSession("service_orders.view")
  if ("response" in guard) return guard.response
  try {
    const locationId = new URL(req.url).searchParams.get("locationId")
    const board = await getTurnsBoard(guard.organizationId, { locationId: locationId || null })
    return NextResponse.json({ ok: true, board }, { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    return ordersErrorResponse(err)
  }
}
