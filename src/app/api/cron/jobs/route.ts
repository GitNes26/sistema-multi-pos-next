import { NextResponse } from "next/server"
import { recoverStaleJobs, runDueJobs } from "@/lib/jobs"

/**
 * GET /api/cron/jobs — respaldo del ejecutor interno: reencola trabajos interrumpidos y procesa
 * los pendientes. Útil con un cron externo (Dokploy) cada minuto. Con CRON_SECRET exige
 * `Authorization: Bearer <secreto>`.
 */
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }
  const recovered = await recoverStaleJobs()
  const started = await runDueJobs()
  return NextResponse.json({ ok: true, recovered, started, timestamp: new Date().toISOString() })
}
