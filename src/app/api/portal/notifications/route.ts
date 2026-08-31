import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.scope !== "portal" || !session.user.organizationId) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const filter = searchParams.get("filter")

  const where: Record<string, unknown> = {
    organizationId: session.user.organizationId,
    userId: session.user.id,
  }
  if (filter === "unread") where.readAt = null

  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.notification.count({
        where: {
          organizationId: session.user.organizationId,
          userId: session.user.id,
          readAt: null,
        },
      }),
    ])

    return NextResponse.json({
      ok: true,
      notifications: notifications.map((n) => ({
        id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        severity: n.severity,
        link: n.link,
        metadata: n.metadata,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
    })
  } catch (err) {
    console.error("[portal/notifications] GET", err)
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 })
  }
}

/** Marcar todas las notificaciones del cliente como leídas */
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.scope !== "portal" || !session.user.organizationId) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 })
  }

  try {
    await prisma.notification.updateMany({
      where: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
        readAt: null,
      },
      data: { readAt: new Date() },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[portal/notifications] POST", err)
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 })
  }
}
