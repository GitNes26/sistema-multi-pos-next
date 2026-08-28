import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.scope !== "portal" || !session.user.organizationId) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 })
  }

  try {
    const notifications = await prisma.notification.findMany({
      where: {
        organizationId: session.user.organizationId,
        userId: session.user.id,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

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
    })
  } catch (err) {
    console.error("[portal/notifications]", err)
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 })
  }
}
