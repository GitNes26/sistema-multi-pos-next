import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/db";
import { openTableChannel } from "@/lib/tables/live";
import { safeJson } from "@/lib/api-helpers";

// SSE endpoint for real-time table status updates.
// The POS TableSelector subscribes here so KDS/portal changes appear instantly.

export const dynamic = "force-dynamic";

const encoder = new TextEncoder();
const unregisterByController = new WeakMap<ReadableStreamDefaultController<Uint8Array>, () => void>();

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const organizationId = effectiveOrgId(session);
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Sin organización" }, { status: 403 });
  }

  const url = new URL(req.url);
  const locationId = url.searchParams.get("locationId");

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      unregisterByController.set(controller, openTableChannel(organizationId, controller));

      // Send the current table list on connect so the client has an initial snapshot.
      prisma.table
        .findMany({
          where: { organizationId, isActive: true, ...(locationId ? { locationId } : {}) },
          include: { location: { select: { name: true } } },
          orderBy: { number: "asc" },
        })
        .then((tables) => {
          const payload = {
            tables: tables.map((t) => ({
              id: t.id,
              number: t.number,
              name: t.name,
              capacity: t.capacity,
              status: t.status,
              location: t.location,
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
