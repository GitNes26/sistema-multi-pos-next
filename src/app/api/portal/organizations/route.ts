import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { prisma } from "@/lib/db"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.scope !== "portal")
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 401 }
    )
  const rows = await prisma.customer.findMany({
    where: { userId: session.user.id, isActive: true },
    select: {
      organization: {
        select: {
          id: true,
          name: true,
          businessMode: true,
          currency: true,
          companyProfile: { select: { tradeName: true } },
        },
      },
    },
    orderBy: { organization: { name: "asc" } },
  })
  return NextResponse.json({
    ok: true,
    organizations: rows.map(({ organization }) => ({
      id: organization.id,
      name: organization.companyProfile?.tradeName ?? organization.name,
      businessMode: organization.businessMode,
      currency: organization.currency,
    })),
  })
}
