import { NextResponse } from "next/server"
import { requestBill, MenuError } from "@/lib/tables/menu"

export const dynamic = "force-dynamic"

// POST /api/public/menu/bill — el comensal pide la cuenta (avisa al personal).
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { tableId?: string; token?: string }
    return NextResponse.json(await requestBill(body.tableId ?? "", body.token ?? ""))
  } catch (err) {
    if (err instanceof MenuError) return NextResponse.json({ ok: false, error: err.message }, { status: err.status })
    console.error("[public/menu/bill]", err)
    return NextResponse.json({ ok: false, error: "No se pudo avisar" }, { status: 500 })
  }
}
