import { subscribe } from "@/lib/realtime"
import { portalOrdersChannel } from "@/lib/service-orders/server"
import { requirePortalCustomer } from "../../guard"

// SSE del cliente: se entera al instante cuando una de SUS órdenes cambia de etapa. El canal es por cliente
// (nunca por empresa), así que no recibe nada de otros clientes.
export const dynamic = "force-dynamic"

const encoder = new TextEncoder()
const unregisterByController = new WeakMap<ReadableStreamDefaultController<Uint8Array>, () => void>()

export async function GET() {
  const guard = await requirePortalCustomer()
  if ("response" in guard) return guard.response
  const channel = portalOrdersChannel(guard.organizationId, guard.customerId)
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      unregisterByController.set(controller, subscribe(channel, controller))
      controller.enqueue(encoder.encode(": connected\n\n"))
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"))
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
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  })
}
