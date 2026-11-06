import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { prisma } from "@/lib/db"
import { joinBusiness } from "@/lib/customers/join"
import { mapsUrl } from "@/lib/geo"
import { formatSchedule, isScheduleOpenNow, parseSchedule } from "@/lib/schedule"

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
        closedManually: true,
        closedUntil: true,
        companyProfile: { select: { tradeName: true, logoUrl: true, city: true, state: true, address: true, phone: true, email: true, website: true } },
        appSettings: { select: { primaryHue: true } },
      },
      orderBy: { name: "asc" },
      take: 200,
    }),
    prisma.customer.findMany({ where: { userId: user.id, isActive: true }, select: { organizationId: true, customerCode: true } }),
  ])
  const locations = await prisma.location.findMany({
    where: { organizationId: { in: orgs.map((o) => o.id) }, isActive: true },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      organizationId: true,
      name: true,
      address: true,
      latitude: true,
      longitude: true,
      phone: true,
      email: true,
      timezone: true,
      openingScheduleJson: true,
      allowsDelivery: true,
      allowsPickup: true,
    },
  })
  const byOrg = new Map<string, typeof locations>()
  for (const l of locations) byOrg.set(l.organizationId, [...(byOrg.get(l.organizationId) ?? []), l])

  const now = new Date()
  const joined = new Map(mine.map((c) => [c.organizationId, c.customerCode]))
  return NextResponse.json({
    ok: true,
    activeOrganizationId: user.organizationId ?? null,
    businesses: orgs.map((o) => {
      const manuallyClosed = o.closedManually && !(o.closedUntil && o.closedUntil <= now)
      const branches = (byOrg.get(o.id) ?? []).map((l) => {
        const schedule = l.openingScheduleJson ? parseSchedule(l.openingScheduleJson) : null
        const hasSchedule = Boolean(schedule?.some((d) => d.enabled))
        const state = manuallyClosed ? { open: false, message: "Cerrado temporalmente" } : hasSchedule ? isScheduleOpenNow(schedule, l.timezone) : null
        const latitude = l.latitude != null ? Number(l.latitude) : null
        const longitude = l.longitude != null ? Number(l.longitude) : null
        return {
          id: l.id,
          name: l.name,
          address: l.address,
          latitude,
          longitude,
          phone: l.phone,
          email: l.email,
          hours: hasSchedule && schedule ? formatSchedule(schedule) : null,
          /** null = la sucursal no publicó horario. */
          open: state ? state.open : null,
          statusLabel: state ? state.message : "Sin horario publicado",
          allowsDelivery: l.allowsDelivery,
          allowsPickup: l.allowsPickup,
          mapUrl: mapsUrl(latitude, longitude, l.address),
        }
      })
      const known = branches.filter((b) => b.open !== null)
      return {
        id: o.id,
        name: o.companyProfile?.tradeName ?? o.name,
        businessMode: o.businessMode,
        logoUrl: o.companyProfile?.logoUrl ?? null,
        city: o.companyProfile?.city ?? null,
        state: o.companyProfile?.state ?? null,
        address: o.companyProfile?.address ?? null,
        phone: o.companyProfile?.phone ?? null,
        email: o.companyProfile?.email ?? null,
        website: o.companyProfile?.website ?? null,
        hue: o.appSettings?.primaryHue ?? null,
        joined: joined.has(o.id),
        customerCode: joined.get(o.id) ?? null,
        /** Abierto si alguna sucursal lo está; null si ninguna publicó horario. */
        open: manuallyClosed ? false : known.length ? known.some((b) => b.open) : null,
        delivers: branches.some((b) => b.allowsDelivery),
        locations: branches,
      }
    }),
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
