import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { openOrgChannel, broadcastItems } from "@/lib/notifications/live";
import { notificationToPayload } from "@/lib/notifications/helpers";

// FASE 8.9 / 11 — SSE endpoint de notificaciones en tiempo real.
// Envía las no leídas al conectar y hace broadcast de las nuevas.

export const dynamic = "force-dynamic";

const encoder = new TextEncoder();
const unregisterByController = new WeakMap<ReadableStreamDefaultController<Uint8Array>, () => void>();

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const organizationId = session.user.organizationId;
  if (session.user.scope === "portal" || !organizationId) {
    return NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      unregisterByController.set(controller, openOrgChannel(organizationId, controller));

      // Enviar las pendientes que ya existen.
      prisma.notification
        .findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 40 })
        .then((recent) => broadcastItems(organizationId, recent.map(notificationToPayload)))
        .catch(() => {
          // Falla la carga inicial: el broadcast en vivo sigue funcionando.
        });

      // Heartbeat para mantener viva la conexión.
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(ping);
        }
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