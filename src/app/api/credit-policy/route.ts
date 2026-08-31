import { NextResponse } from "next/server";
import { ordersGuard, ordersErrorResponse } from "../orders/guard";
import { getCreditPolicy, upsertCreditPolicy } from "@/lib/credit/server";

export async function GET() {
  const guard = await ordersGuard("settings.manage");
  if (guard instanceof NextResponse) return guard;
  try {
    const policy = await getCreditPolicy(guard.organizationId);
    return NextResponse.json({ ok: true, policy });
  } catch (err) {
    return ordersErrorResponse(err);
  }
}

export async function PUT(req: Request) {
  const guard = await ordersGuard("settings.manage");
  if (guard instanceof NextResponse) return guard;
  try {
    const body = await req.json();
    const policy = await upsertCreditPolicy(guard.organizationId, body);
    return NextResponse.json({ ok: true, policy });
  } catch (err) {
    return ordersErrorResponse(err);
  }
}
