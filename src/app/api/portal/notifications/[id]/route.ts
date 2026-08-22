import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { prisma } from "@/lib/db"

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.scope !== "portal" || !session.user.organizationId) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 })
  }

  const { id } = await params

  try {
    await prisma.notification.updateMany({
      where: { id, organizationId: session.user.organizationId },
      data: { readAt: new Date() },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: "Error" }, { status: 500 })
  }
}
