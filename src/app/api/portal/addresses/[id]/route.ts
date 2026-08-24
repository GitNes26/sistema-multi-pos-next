import { NextResponse } from "next/server";
import { deleteCustomerAddress } from "@/lib/portal/server";
import { requirePortalCustomer, portalErrorResponse } from "../../guard";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requirePortalCustomer();
  if ("response" in ctx) return ctx.response;
  const { id } = await params;
  try {
    await deleteCustomerAddress(ctx.organizationId, ctx.customerId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return portalErrorResponse(err);
  }
}
