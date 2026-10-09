import { NextResponse } from "next/server"
import { sendCart, MenuError } from "@/lib/tables/menu"

export const dynamic = "force-dynamic"

// POST /api/public/menu/send — manda el carrito de la mesa a cocina.
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { tableId?: string; token?: string }
    const result = await sendCart(body.tableId ?? "", body.token ?? "")
    return NextResponse.json({ ok: true, orderNumber: result.orderNumber })
  } catch (err) {
    if (err instanceof MenuError) return NextResponse.json({ ok: false, error: err.message }, { status: err.status })
    console.error("[public/menu/send]", err)
    return NextResponse.json({ ok: false, error: "No se pudo enviar a cocina" }, { status: 500 })
  }
}
