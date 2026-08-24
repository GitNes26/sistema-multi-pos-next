import { NextResponse } from "next/server";
import { getDeliveryPolicy } from "@/lib/orders/server";
import { getPaymentConfig } from "@/lib/payments/server";
import { requirePortalCustomer, portalErrorResponse } from "../guard";

export async function GET() {
  const ctx = await requirePortalCustomer();
  if ("response" in ctx) return ctx.response;

  try {
    const [policy, paymentConfig] = await Promise.all([
      getDeliveryPolicy(ctx.organizationId),
      getPaymentConfig(ctx.organizationId),
    ]);
    const onlinePaymentEnabled = paymentConfig.provider !== "none";
    return NextResponse.json({ ok: true, policy, onlinePaymentEnabled });
  } catch (err) {
    return portalErrorResponse(err);
  }
}
