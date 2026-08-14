import { NextResponse } from "next/server";
import { getRecentOrders, getSalesStats } from "@/lib/pos/server";
import { requirePosSession, resolveLocationId } from "../helpers";

export async function GET(req: Request) {
  const guard = await requirePosSession();
  if ("response" in guard) return guard.response;
  const { session } = guard;
  const organizationId = session.user.organizationId!;
  const { searchParams } = new URL(req.url);
  const locationId = await resolveLocationId(organizationId, searchParams.get("locationId"));

  try {
    const [orders, stats] = await Promise.all([
      getRecentOrders(organizationId, locationId),
      getSalesStats(organizationId, locationId),
    ]);
    return NextResponse.json({ ok: true, orders, stats });
  } catch (err) {
    console.error("[pos/orders]", err);
    return NextResponse.json({ ok: false, error: "Error al consultar pedidos" }, { status: 500 });
  }
}