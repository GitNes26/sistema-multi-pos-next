import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth/options"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { openCatalogChannel } from "@/lib/catalog/live"

// SSE de cambios en lo vendible (servicios activados/desactivados). Lo usan las cajas de la
// empresa y la tienda del portal; no lleva datos sensibles, solo "algo cambió" para que recarguen.

export const dynamic = "force-dynamic"

const encoder = new TextEncoder()
const unregisterByController = new WeakMap<ReadableStreamDefaultController<Uint8Array>, () => void>()

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })
  const organizationId = effectiveOrgId(session)
  if (!organizationId) return NextResponse.json({ ok: false, error: "Sin organización" }, { status: 403 })

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      unregisterByController.set(controller, openCatalogChannel(organizationId, controller))
      controller.enqueue(encoder.encode(`: connected\n\n`))
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`))
        } catch {
          clearInterval(ping)
        }
      }, 25_000)
    },
    cancel(controller) {
      unregisterByController.get(controller)?.()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
