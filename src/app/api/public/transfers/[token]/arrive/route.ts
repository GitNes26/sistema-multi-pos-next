import { NextResponse } from "next/server"
import { confirmArrivalByToken } from "@/lib/inventory/transfers"

export const dynamic = "force-dynamic"

// POST — el chofer sin cuenta confirma que llegó al destino.
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    return NextResponse.json(await confirmArrivalByToken(token))
  } catch (err) {
    const status = err && typeof err === "object" && "status" in err ? Number((err as { status: unknown }).status) : 500
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Error" }, { status })
  }
}
