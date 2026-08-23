import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { openDriverLocationChannel } from "@/lib/portal/driver-location";
import { getPortalCustomer } from "@/lib/portal/server";

// GET — SSE stream for customer to receive real-time driver location.
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();
const unregisterByController = new WeakMap<ReadableStreamDefaultController<Uint8Array>, () => void>();

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.scope !== "portal" || !session.user.organizationId) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const organizationId = session.user.organizationId;
  const customer = await getPortalCustomer(organizationId, session.user.id);
  if (!customer) {
    return NextResponse.json({ ok: false, error: "Cliente no encontrado" }, { status: 403 });
  }

  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, organizationId, customerId: customer.id },
    select: { id: true, status: true },
  });
  if (!order) {
    return NextResponse.json({ ok: false, error: "Pedido no encontrado" }, { status: 404 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      unregisterByController.set(controller, openDriverLocationChannel(order.id, controller));

      const ping = setInterval(() => {
        try { controller.enqueue(encoder.encode(`: ping\n\n`)); } catch { clearInterval(ping); }
      }, 25_000);
    },
    cancel(controller) {
      unregisterByController.get(controller)?.();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
