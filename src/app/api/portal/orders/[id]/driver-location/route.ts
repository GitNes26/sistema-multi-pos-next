import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";
import { updateDriverLocation } from "@/lib/portal/driver-location";

// POST — Driver reports their current location for a delivery order.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const { id: orderId } = await params;
  const body = await req.json().catch(() => ({}));
  const { lat, lng } = body as { lat?: number; lng?: number };

  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ ok: false, error: "lat y lng requeridos" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true },
  });
  if (!order) {
    return NextResponse.json({ ok: false, error: "Pedido no encontrado" }, { status: 404 });
  }
  if (order.status !== "in_transit") {
    return NextResponse.json({ ok: false, error: "El pedido no está en camino" }, { status: 400 });
  }

  updateDriverLocation({ orderId, lat, lng, updatedAt: new Date().toISOString() });

  return NextResponse.json({ ok: true });
}
