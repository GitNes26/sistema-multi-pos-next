import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { cacheStats } from "@/lib/cache"
import { jobStats } from "@/lib/jobs"

/**
 * GET /api/health — salud para el balanceador y el monitoreo.
 *  - Sin credenciales: solo { ok } (200 si la base de datos responde, 503 si no).
 *  - Con `Authorization: Bearer <CRON_SECRET>`: añade latencia de BD, caché, cola y memoria.
 */
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const started = Date.now()
  let dbOk = true
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    dbOk = false
  }
  const secret = process.env.CRON_SECRET
  const detailed = Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`
  const status = dbOk ? 200 : 503
  if (!detailed) return NextResponse.json({ ok: dbOk }, { status })
  const mem = process.memoryUsage()
  return NextResponse.json(
    {
      ok: dbOk,
      dbMs: Date.now() - started,
      cache: cacheStats(),
      jobs: dbOk ? await jobStats().catch(() => null) : null,
      memoryMb: { rss: Math.round(mem.rss / 1048576), heapUsed: Math.round(mem.heapUsed / 1048576) },
      uptimeSec: Math.round(process.uptime()),
    },
    { status }
  )
}
