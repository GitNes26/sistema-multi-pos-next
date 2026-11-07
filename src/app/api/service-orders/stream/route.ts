import { subscribe } from "@/lib/realtime"
import { serviceOrdersChannel } from "@/lib/service-orders/server"
import { requireOrdersSession } from "../helpers"

// SSE: el tablero se entera al instante cuando otra caja o pantalla cambia una orden.
export const dynamic = "force-dynamic"

const encoder = new TextEncoder()
const unregisterByController = new WeakMap<ReadableStreamDefaultController<Uint8Array>, () => void>()

export async function GET() {
  const guard = await requireOrdersSession("service_orders.view")
  if ("response" in guard) return guard.response
  const channel = serviceOrdersChannel(guard.organizationId)
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
