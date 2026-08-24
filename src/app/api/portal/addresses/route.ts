import { NextResponse } from "next/server";
import { listCustomerAddresses, createCustomerAddress } from "@/lib/portal/server";
import { requirePortalCustomer, portalErrorResponse } from "../guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requirePortalCustomer();
  if ("response" in ctx) return ctx.response;
  try {
    const addresses = await listCustomerAddresses(ctx.organizationId, ctx.customerId);
    return NextResponse.json({ ok: true, addresses });
  } catch (err) {
    return portalErrorResponse(err);
  }
}

export async function POST(req: Request) {
  const ctx = await requirePortalCustomer();
  if ("response" in ctx) return ctx.response;
  try {
    const body = await req.json();
    const address = await createCustomerAddress(ctx.organizationId, ctx.customerId, body);
    return NextResponse.json({ ok: true, address });
  } catch (err) {
    return portalErrorResponse(err);
  }
}
