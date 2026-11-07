import { NextResponse } from "next/server"
import { getBookableServices } from "@/lib/agenda/server"
import { ordersErrorResponse, requireOrdersSession } from "../helpers"

export const dynamic = "force-dynamic"

// Servicios que se pueden poner en una orden (variantes de productos sin inventario) con su precio.
export async function GET() {
  const guard = await requireOrdersSession("service_orders.view")
  if ("response" in guard) return guard.response
  try {
    return NextResponse.json({ ok: true, services: await getBookableServices(guard.organizationId) })
  } catch (err) {
    return ordersErrorResponse(err)
  }
}
