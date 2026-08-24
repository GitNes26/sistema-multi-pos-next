import { NextResponse } from "next/server";
import { confirmDelivery } from "@/lib/orders/server";
import { ordersGuard, ordersErrorResponse } from "../../guard";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await ordersGuard("orders.manage");
  if (guard instanceof NextResponse) return guard;
  const { id } = await params;

  try {
    const body = (await req.json()) as { pin?: string; qrToken?: string };
    const result = await confirmDelivery(guard.organizationId, id, body);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, order: result.order });
  } catch (err) {
    return ordersErrorResponse(err);
  }
}
