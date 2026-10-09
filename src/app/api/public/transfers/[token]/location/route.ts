import { NextResponse } from "next/server"
import { recordTransferLocationByToken } from "@/lib/inventory/transfers"

export const dynamic = "force-dynamic"

// POST { lat, lng, accuracy? } — el chofer sin cuenta comparte su ubicación con el enlace del traslado.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const body = (await req.json().catch(() => ({}))) as { lat?: number; lng?: number; accuracy?: number }
    if (typeof body.lat !== "number" || typeof body.lng !== "number") return NextResponse.json({ ok: false, error: "lat y lng requeridos" }, { status: 400 })
    return NextResponse.json(await recordTransferLocationByToken(token, { lat: body.lat, lng: body.lng, accuracy: body.accuracy ?? null }))
  } catch (err) {
    const status = err && typeof err === "object" && "status" in err ? Number((err as { status: unknown }).status) : 500
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Error" }, { status })
  }
}
