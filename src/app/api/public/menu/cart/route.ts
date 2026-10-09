import { NextResponse } from "next/server"
import { saveCart, MenuError } from "@/lib/tables/menu"

export const dynamic = "force-dynamic"

// PUT /api/public/menu/cart — reemplaza el carrito de la mesa (compartido entre comensales).
export async function PUT(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { tableId?: string; token?: string; items?: unknown }
    const cart = await saveCart(body.tableId ?? "", body.token ?? "", body.items)
    return NextResponse.json({ ok: true, cart })
  } catch (err) {
    if (err instanceof MenuError) return NextResponse.json({ ok: false, error: err.message }, { status: err.status })
    console.error("[public/menu/cart]", err)
    return NextResponse.json({ ok: false, error: "No se pudo guardar el carrito" }, { status: 500 })
  }
}
