import { NextResponse } from "next/server"
import { getTransferByToken } from "@/lib/inventory/transfers"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    return NextResponse.json({ ok: true, transfer: await getTransferByToken(token) })
  } catch {
    return NextResponse.json({ ok: false, error: "Enlace inválido o vencido" }, { status: 404 })
  }
}
