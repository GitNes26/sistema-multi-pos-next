import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/options"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { hasPermission } from "@/lib/auth/permissions"
import { prisma } from "@/lib/db"
import { buildFloorPlanPdf, type PlanPdfPage } from "@/lib/tables/plan-pdf"

export const dynamic = "force-dynamic"

// GET /api/tables/plan/pdf?roomId=<id|none|all>&locationId=<id>
// Plano de sala en PDF (una hoja por sala). Requiere ver sucursales.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  const organizationId = effectiveOrgId(session)
  if (!session?.user || !organizationId) return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 })
  if (!hasPermission(session, "locations.view") && !hasPermission(session, "locations.manage")) {
    return NextResponse.json({ ok: false, error: "Sin permiso" }, { status: 403 })
  }

  const url = new URL(req.url)
  const locationId = url.searchParams.get("locationId") || undefined
  const roomParam = url.searchParams.get("roomId") || "all"

  const [org, company, rooms, tables, nodes, location] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    prisma.companyProfile.findUnique({ where: { organizationId }, select: { tradeName: true, legalName: true, logoUrl: true } }),
    prisma.tableRoom.findMany({
      where: { organizationId, isActive: true, ...(locationId ? { locationId } : {}) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.table.findMany({ where: { organizationId, isActive: true, ...(locationId ? { locationId } : {}) }, orderBy: { number: "asc" } }),
    prisma.planNode.findMany({ where: { organizationId, ...(locationId ? { locationId } : {}) } }),
    locationId ? prisma.location.findFirst({ where: { id: locationId, organizationId }, select: { name: true } }) : Promise.resolve(null),
  ])

  const build = (title: string, roomId: string | null): PlanPdfPage => ({
    title,
    tables: tables
      .filter((t) => (t.roomId ?? null) === roomId)
      .map((t) => ({ number: t.number, name: t.name, capacity: t.capacity, shape: t.shape, width: t.width, height: t.height, posX: t.posX, posY: t.posY, rotation: t.rotation })),
    nodes: nodes.filter((n) => (n.roomId ?? null) === roomId).map((n) => ({ kind: n.kind, label: n.label, posX: n.posX, posY: n.posY, rotation: n.rotation })),
  })

  let pages: PlanPdfPage[]
  if (roomParam === "all") {
    pages = [build("Sin sala", null), ...rooms.map((r) => build(r.name, r.id))].filter((p) => p.tables.length || p.nodes.length)
  } else if (roomParam === "none") {
    pages = [build("Sin sala", null)]
  } else {
    const room = rooms.find((r) => r.id === roomParam)
    if (!room) return NextResponse.json({ ok: false, error: "Sala no encontrada" }, { status: 404 })
    pages = [build(room.name, room.id)]
  }

  const buffer = await buildFloorPlanPdf({
    company: company?.tradeName ?? company?.legalName ?? org?.name ?? "Empresa",
    logoUrl: company?.logoUrl ?? null,
    subtitle: location?.name,
    pages,
  })
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="plano-de-sala.pdf"`,
      "Cache-Control": "no-store",
    },
  })
}
