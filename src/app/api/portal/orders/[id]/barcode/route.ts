import { NextResponse } from "next/server"
import bwipjs from "bwip-js/node"
import { prisma } from "@/lib/db"
import { buildTicketCode } from "@/lib/sales/ticket-code"
import { requirePortalCustomer } from "../../../guard"

// Código de barras del ticket de un pedido del cliente (el mismo que imprime el POS),
// para que la sucursal lo escanee al pedir una aclaración. Solo del propio cliente.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePortalCustomer()
  if ("response" in guard) return guard.response
  const { id } = await params
  const order = await prisma.order.findFirst({
    where: { id, organizationId: guard.organizationId, customerId: guard.customerId },
    select: { saleId: true },
  })
  if (!order?.saleId) {
    return NextResponse.json({ ok: false, error: "El ticket aún no está disponible" }, { status: 404 })
  }
  const svg = bwipjs.toSVG({
    bcid: "code128",
    text: buildTicketCode({ saleId: order.saleId }),
    height: 10,
    includetext: false,
    paddingwidth: 0,
    paddingheight: 0,
  })
  return new NextResponse(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, max-age=300" } })
}
