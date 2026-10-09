import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { prisma } from "@/lib/db"
import { joinBusiness } from "@/lib/customers/join"

// Negocios disponibles para el cliente. La cuenta es compartida: cada negocio
// guarda por separado su historial, puntos, crédito, listas y favoritos.

async function portalUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.scope !== "portal") return null
  return session.user
}

export async function GET() {
  const user = await portalUser()
  if (!user) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })
  const [orgs, mine] = await Promise.all([
    prisma.organization.findMany({
      where: { isBlocked: false },
      select: {
        id: true,
        name: true,
        businessMode: true,
        companyProfile: { select: { tradeName: true, logoUrl: true, city: true } },
        appSettings: { select: { primaryHue: true } },
      },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.customer.findMany({ where: { userId: user.id, isActive: true }, select: { organizationId: true, customerCode: true } }),
  ])
  const joined = new Map(mine.map((c) => [c.organizationId, c.customerCode]))
  return NextResponse.json({
    ok: true,
    activeOrganizationId: user.organizationId ?? null,
    businesses: orgs.map((o) => ({
      id: o.id,
      name: o.companyProfile?.tradeName ?? o.name,
      businessMode: o.businessMode,
      logoUrl: o.companyProfile?.logoUrl ?? null,
      city: o.companyProfile?.city ?? null,
      hue: o.appSettings?.primaryHue ?? null,
      joined: joined.has(o.id),
      customerCode: joined.get(o.id) ?? null,
    })),
  })
}

export async function POST(req: Request) {
  const user = await portalUser()
  if (!user) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })
  const body = (await req.json().catch(() => ({}))) as { organizationId?: string }
  if (!body.organizationId) return NextResponse.json({ ok: false, error: "Elige un negocio" }, { status: 400 })
  try {
    const customer = await joinBusiness(user.id, body.organizationId)
    return NextResponse.json({ ok: true, organizationId: body.organizationId, customerCode: customer.customerCode })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "No se pudo unir al negocio" }, { status: 400 })
  }
}
