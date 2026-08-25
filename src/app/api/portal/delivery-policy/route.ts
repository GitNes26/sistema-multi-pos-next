import { NextResponse } from "next/server";
import { getEffectiveDeliveryPolicy } from "@/lib/orders/server";
import { getPaymentConfig } from "@/lib/payments/server";
import { requirePortalCustomer, portalErrorResponse } from "../guard";

export async function GET(req: Request) {
  const ctx = await requirePortalCustomer();
  if ("response" in ctx) return ctx.response;

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId") || undefined;

  try {
    const [policy, paymentConfig] = await Promise.all([
      getEffectiveDeliveryPolicy(ctx.organizationId, branchId),
      getPaymentConfig(ctx.organizationId),
    ]);
    const onlinePaymentEnabled = paymentConfig.provider !== "none";
    return NextResponse.json({ ok: true, policy, onlinePaymentEnabled });
  } catch (err) {
    return portalErrorResponse(err);
  }
}
