import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { prisma } from "@/lib/db"

// Estado de un trabajo en segundo plano. Solo lo ve quien lo inició, dentro de su empresa.

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  const organizationId = effectiveOrgId(session)
  if (!session?.user || !organizationId) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })
  const { id } = await params
  const job = await prisma.backgroundJob.findFirst({
    where: { id, organizationId, userId: session.user.id },
    select: { id: true, type: true, status: true, progress: true, result: true, error: true, attempts: true, createdAt: true, finishedAt: true },
  })
  if (!job) return NextResponse.json({ ok: false, error: "Trabajo no encontrado" }, { status: 404 })
  return NextResponse.json({ ok: true, job })
}
