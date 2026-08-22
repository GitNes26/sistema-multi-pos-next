import { NextResponse } from "next/server";
import { getDeliveryPolicy } from "@/lib/orders/server";
import { requirePortalCustomer, portalErrorResponse } from "../guard";

export async function GET() {
  const ctx = await requirePortalCustomer();
  if ("response" in ctx) return ctx.response;

  try {
    const policy = await getDeliveryPolicy(ctx.organizationId);
    return NextResponse.json({ ok: true, policy });
  } catch (err) {
    return portalErrorResponse(err);
  }
}
