import { NextRequest, NextResponse } from "next/server"
import bwipjs from "bwip-js/node"
import { prisma } from "@/lib/db"
import { requirePosSession } from "../../../helpers"
import { effectiveOrgId } from "@/lib/auth/org-context"
import { buildTicketCode } from "@/lib/sales/ticket-code"

export const runtime = "nodejs"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePosSession()
  if ("response" in guard) return guard.response
  const organizationId = effectiveOrgId(guard.session)!
  const { id } = await params
  const sale = await prisma.sale.findFirst({ where: { id, organizationId }, select: { id: true, locationId: true } })
  if (!sale) return NextResponse.json({ ok: false, error: "Venta no encontrada" }, { status: 404 })
  const svg = bwipjs.toSVG({
    bcid: "code128",
    text: buildTicketCode({ saleId: sale.id }),
    height: 10,
    includetext: false,
    paddingwidth: 0,
    paddingheight: 0,
  })
  return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, max-age=300" } })
}
