import { NextResponse } from "next/server"
import { getMenu, MenuError } from "@/lib/tables/menu"
import { safeJson } from "@/lib/api-helpers"

export const dynamic = "force-dynamic"

// GET /api/public/menu?table=&token= — menú, carrito compartido y cuenta de la mesa (sin sesión).
export async function GET(req: Request) {
  const url = new URL(req.url)
  try {
    const data = await getMenu(url.searchParams.get("table") ?? "", url.searchParams.get("token") ?? "")
    return NextResponse.json({ ok: true, ...(safeJson(data) as object) }, { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    if (err instanceof MenuError) return NextResponse.json({ ok: false, error: err.message }, { status: err.status })
    console.error("[public/menu]", err)
    return NextResponse.json({ ok: false, error: "No se pudo cargar el menú" }, { status: 500 })
  }
}
