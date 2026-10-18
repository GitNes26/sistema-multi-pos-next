import { NextRequest, NextResponse } from "next/server"
import { reportsGuard, reportsErrorResponse } from "../guard"
import { getProfitSummary } from "@/lib/reports/profit"

export const dynamic = "force-dynamic"

const YMD = /^\d{4}-\d{2}-\d{2}$/

// «¿Cómo me fue?»: ganancia o pérdida del periodo. Exige el permiso de gastos
// (quien ve la ganancia ve también lo que se gasta).
export async function GET(req: NextRequest) {
  const guard = await reportsGuard("expenses.view")
  if (guard instanceof NextResponse) return guard
  const sp = req.nextUrl.searchParams
  const from = sp.get("from") ?? ""
  const to = sp.get("to") ?? ""
  if (!YMD.test(from) || !YMD.test(to) || from > to) {
    return NextResponse.json({ ok: false, error: "Elige un periodo válido" }, { status: 400 })
  }
  try {
    const summary = await getProfitSummary(guard.organizationId, from, to, sp.get("locationId") || undefined)
    return NextResponse.json({ ok: true, summary })
  } catch (err) {
    return reportsErrorResponse(err)
  }
}
