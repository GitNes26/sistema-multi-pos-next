import { NextResponse } from "next/server"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { getSupervisorSettings } from "@/lib/settings/server"
import { requirePosSession } from "../helpers"

export const dynamic = "force-dynamic"

// GET /api/pos/supervisor — qué acciones del POS requieren aprobación de supervisor.
export async function GET() {
  const guard = await requirePosSession()
  if ("response" in guard) return guard.response
  const organizationId = effectiveOrgId(guard.session)!
  return NextResponse.json({ ok: true, settings: await getSupervisorSettings(organizationId) })
}
