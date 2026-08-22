import { NextResponse } from "next/server";
import { getDeliveryPolicy, upsertDeliveryPolicy } from "@/lib/orders/server";
import { ordersGuard, ordersErrorResponse } from "../orders/guard";

export async function GET() {
  const guard = await ordersGuard("orders.view");
  if (guard instanceof NextResponse) return guard;

  try {
    const policy = await getDeliveryPolicy(guard.organizationId);
    return NextResponse.json({ ok: true, policy });
  } catch (err) {
    return ordersErrorResponse(err);
  }
}

export async function PUT(req: Request) {
  const guard = await ordersGuard("orders.manage");
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await req.json();
    const policy = await upsertDeliveryPolicy(guard.organizationId, body);
    return NextResponse.json({ ok: true, policy });
  } catch (err) {
    return ordersErrorResponse(err);
  }
}
