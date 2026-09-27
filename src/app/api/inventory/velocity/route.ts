import { NextRequest, NextResponse } from "next/server";
import type { $Enums } from "@prisma/client";
import { inventoryGuard, inventoryErrorResponse } from "../guard";
import { salesVelocity } from "@/lib/inventory/reorder";

// GET ?locationType&locationId&coverage=7 → venta diaria promedio y mínimo sugerido por fila.
export async function GET(req: NextRequest) {
  const guard = await inventoryGuard("inventory.view");
  if (guard instanceof NextResponse) return guard;
  try {
    const sp = req.nextUrl.searchParams;
    const locationId = sp.get("locationId");
    if (!locationId) return NextResponse.json({ ok: false, error: "Falta la ubicación" }, { status: 400 });
    const rows = await salesVelocity(guard.organizationId, (sp.get("locationType") ?? "location") as $Enums.LocationType, locationId, 30, Number(sp.get("coverage")) || 7);
    return NextResponse.json({ ok: true, rows });
  } catch (err) {
    return inventoryErrorResponse(err);
  }
}
