import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db";

/**
 * POST /api/portal/push/subscribe
 * Guarda una suscripción Web Push del cliente.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { endpoint, p256dh, auth: pushAuth } = body;

  if (!endpoint || !p256dh || !pushAuth) {
    return NextResponse.json({ error: "Missing push subscription fields" }, { status: 400 });
  }

  const organizationId = session.user.activeOrganizationId ?? session.user.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  const userAgent = req.headers.get("user-agent") ?? null;

  // Upsert: si ya existe la suscripción (mismo userId + endpoint), la actualiza
  const existing = await prisma.pushSubscription.findUnique({
    where: { userId_endpoint: { userId: session.user.id, endpoint } },
  });

  if (existing) {
    await prisma.pushSubscription.update({
      where: { id: existing.id },
      data: { p256dh, auth: pushAuth, userAgent, organizationId },
    });
  } else {
    await prisma.pushSubscription.create({
      data: {
        organizationId,
        userId: session.user.id,
        endpoint,
        p256dh,
        auth: pushAuth,
        userAgent,
      },
    });
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/portal/push/subscribe
 * Elimina una suscripción (al hacer logout o desactivar notificaciones).
 */
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { endpoint } = await req.json();

  if (endpoint) {
    // Eliminar suscripción específica
    await prisma.pushSubscription.deleteMany({
      where: { userId: session.user.id, endpoint },
    });
  } else {
    // Eliminar todas las suscripciones del usuario (logout)
    await prisma.pushSubscription.deleteMany({
      where: { userId: session.user.id },
    });
  }

  return NextResponse.json({ ok: true });
}
