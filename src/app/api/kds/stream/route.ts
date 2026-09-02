import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/db";
import { openKdsChannel } from "@/lib/kds/live";
import { safeJson } from "@/lib/api-helpers";

// SSE endpoint for real-time KDS order updates.
// The KitchenDisplay component subscribes here so new/updated orders appear instantly.

export const dynamic = "force-dynamic";

const encoder = new TextEncoder();
const unregisterByController = new WeakMap<ReadableStreamDefaultController<Uint8Array>, () => void>();

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const organizationId = effectiveOrgId(session);
  if (session.user.scope === "portal" || !organizationId) {
    return NextResponse.json({ ok: false, error: "Acceso denegado" }, { status: 403 });
  }

  const url = new URL(req.url);
  const locationId = url.searchParams.get("locationId");

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      unregisterByController.set(controller, openKdsChannel(organizationId, controller));

      // Send current active orders on connect so the client has an initial snapshot.
      prisma.order
        .findMany({
          where: {
            organizationId,
            status: { in: ["pending", "confirmed", "preparing", "ready"] },
            ...(locationId ? { locationId } : {}),
          },
          include: {
            table: { select: { id: true, number: true, name: true } },
            items: {
              select: {
                id: true,
                productName: true,
                variantName: true,
                quantity: true,
                itemStatus: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        })
        .then((orders) => {
          const now = Date.now();
          const payload = {
            orders: orders.map((o) => ({
              id: o.id,
              orderNumber: Number(o.orderNumber),
              status: o.status,
              createdAt: o.createdAt.toISOString(),
              elapsedSeconds: Math.floor((now - o.createdAt.getTime()) / 1000),
              table: o.table,
              location: null,
              items: o.items.map((i) => ({
                id: i.id,
                productName: i.productName,
                variantName: i.variantName,
                quantity: Number(i.quantity),
                itemStatus: i.itemStatus,
                selectedOptions: null,
                comment: null,
              })),
              preparation: null,
            })),
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(safeJson(payload))}\n\n`));
        })
        .catch(() => {
          // Initial load failed; live broadcasts still work.
        });

      // Heartbeat to keep the connection alive.
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
