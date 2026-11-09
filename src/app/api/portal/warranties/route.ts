import { NextResponse } from "next/server"
import { listCustomerWarranties, requestWarranty, WarrantyError } from "@/lib/warranty/server"
import { requirePortalCustomer, portalErrorResponse } from "../guard"

export const dynamic = "force-dynamic"

function fail(err: unknown) {
  if (err instanceof WarrantyError) return NextResponse.json({ ok: false, error: err.message }, { status: err.status })
  return portalErrorResponse(err)
}

// Garantías vigentes sobre mis compras recientes (solo hay si el negocio las habilitó).
export async function GET() {
  const guard = await requirePortalCustomer()
  if ("response" in guard) return guard.response
  try {
    return NextResponse.json({ ok: true, sales: await listCustomerWarranties(guard.organizationId, guard.customerId) })
  } catch (err) {
    return fail(err)
  }
}

// Pido mi garantía: queda registrada y la canjeo en el negocio con mi ticket.
export async function POST(req: Request) {
  const guard = await requirePortalCustomer()
  if ("response" in guard) return guard.response
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    if (!body.saleId || !body.ruleId) return NextResponse.json({ ok: false, error: "Faltan datos" }, { status: 400 })
    const result = await requestWarranty(guard.organizationId, guard.customerId, { saleId: String(body.saleId), ruleId: String(body.ruleId), reason: body.reason ? String(body.reason) : null })
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (err) {
    return fail(err)
  }
}
