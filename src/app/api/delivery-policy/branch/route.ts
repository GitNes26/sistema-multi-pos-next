import { NextResponse } from "next/server";
import { getBranchDeliveryPolicy, upsertBranchDeliveryPolicy, restoreBranchToCompanyPolicy } from "@/lib/orders/server";
import { ordersGuard, ordersErrorResponse } from "../../orders/guard";

export async function GET(req: Request) {
  const guard = await ordersGuard("orders.view");
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  if (!branchId) {
    return NextResponse.json({ ok: false, error: "Falta branchId" }, { status: 400 });
  }

  try {
    const policy = await getBranchDeliveryPolicy(branchId);
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
    const { branchId, ...input } = body;
    if (!branchId) {
      return NextResponse.json({ ok: false, error: "Falta branchId" }, { status: 400 });
    }
    const policy = await upsertBranchDeliveryPolicy(branchId, input);
    return NextResponse.json({ ok: true, policy });
  } catch (err) {
    return ordersErrorResponse(err);
  }
}

export async function DELETE(req: Request) {
  const guard = await ordersGuard("orders.manage");
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId");
  if (!branchId) {
    return NextResponse.json({ ok: false, error: "Falta branchId" }, { status: 400 });
  }

  try {
    await restoreBranchToCompanyPolicy(branchId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return ordersErrorResponse(err);
  }
}
