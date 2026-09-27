import { NextRequest, NextResponse } from "next/server";
import type { $Enums } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { hasPermission } from "@/lib/auth/permissions";
import { inventoryGuard, inventoryErrorResponse } from "../guard";
import { createReorderOrders, getReorderSuggestions } from "@/lib/inventory/reorder";

// GET  ?locationType&locationId → sugerencias de pedido (existencias en mínimo).
// POST { locationType, locationId, orders[] } → crea las órdenes de compra.

export async function GET(req: NextRequest) {
  const guard = await inventoryGuard("inventory.view");
  if (guard instanceof NextResponse) return guard;
  try {
    const sp = req.nextUrl.searchParams;
    const locationId = sp.get("locationId");
    if (!locationId) return NextResponse.json({ ok: false, error: "Falta la ubicación" }, { status: 400 });
    const groups = await getReorderSuggestions(guard.organizationId, (sp.get("locationType") ?? "location") as $Enums.LocationType, locationId);
    return NextResponse.json({ ok: true, groups });
  } catch (err) {
    return inventoryErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  const guard = await inventoryGuard("inventory.view");
  if (guard instanceof NextResponse) return guard;
  const session = await getServerSession(authOptions);
  if (!hasPermission(session, "purchasing.manage")) {
    return NextResponse.json({ ok: false, error: "Necesitas permiso de compras para crear órdenes" }, { status: 403 });
  }
  try {
    const body = await req.json();
    return NextResponse.json(await createReorderOrders(guard.organizationId, guard.userId, body), { status: 201 });
  } catch (err) {
    return inventoryErrorResponse(err);
  }
}
