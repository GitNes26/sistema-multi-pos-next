import { NextRequest, NextResponse } from "next/server";
import type { $Enums } from "@prisma/client";
import { inventoryGuard, inventoryErrorResponse } from "./guard";
import { inventorySnapshot } from "@/lib/inventory/server";

// FASE 8.1 — Snapshot de existencias por sucursal/CEDIS.

export async function GET(req: NextRequest) {
  const guard = await inventoryGuard("inventory.view");
  if (guard instanceof NextResponse) return guard;
  const { organizationId } = guard;

  try {
    const locationType = (req.nextUrl.searchParams.get("locationType") ?? "location") as $Enums.LocationType;
    const locationId = req.nextUrl.searchParams.get("locationId") ?? "";
    if (!locationId) {
      return NextResponse.json({ ok: false, error: "Falta la ubicación" }, { status: 400 });
    }
    const rows = await inventorySnapshot(organizationId, {
      locationType,
      locationId,
      q: req.nextUrl.searchParams.get("q") ?? undefined,
      productType: req.nextUrl.searchParams.get("productType") ?? undefined,
      lowOnly: req.nextUrl.searchParams.get("lowOnly") === "true",
    });
    return NextResponse.json({ ok: true, rows });
  } catch (err) {
    return inventoryErrorResponse(err);
  }
}