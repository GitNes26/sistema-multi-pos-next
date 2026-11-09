import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { hasPermission } from "@/lib/auth/permissions"
import { applyBusinessTemplate, listTemplates, TemplateError } from "@/lib/templates/server"
import { LoyaltyError } from "@/lib/loyalty/server"

export const dynamic = "force-dynamic"

async function guard() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { response: NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 }) }
  const organizationId = effectiveOrgId(session)
  if (session.user.scope === "portal" || !organizationId) return { response: NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 }) }
  if (!hasPermission(session, "settings.manage")) return { response: NextResponse.json({ ok: false, error: "Permiso requerido: settings.manage" }, { status: 403 }) }
  return { organizationId }
}

// Plantillas de arranque con su estado en esta empresa.
export async function GET() {
  const g = await guard()
  if ("response" in g) return g.response
  return NextResponse.json({ ok: true, templates: await listTemplates(g.organizationId) })
}

// Aplica una plantilla (idempotente: solo crea lo que falta).
export async function POST(req: Request) {
  const g = await guard()
  if ("response" in g) return g.response
  try {
    const body = (await req.json().catch(() => ({}))) as { key?: unknown }
    return NextResponse.json({ ok: true, ...(await applyBusinessTemplate(g.organizationId, String(body.key ?? ""))) })
  } catch (err) {
    if (err instanceof TemplateError || err instanceof LoyaltyError) return NextResponse.json({ ok: false, error: err.message }, { status: err.status })
    console.error("[templates]", err)
    return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 })
  }
}
