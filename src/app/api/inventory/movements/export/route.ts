import { NextRequest, NextResponse } from "next/server";
import type { $Enums } from "@prisma/client";
import { inventoryGuard, inventoryErrorResponse } from "../../guard";
import { exportMovementsXlsx } from "@/lib/inventory/server";

// Exportación del historial de movimientos en Excel (.xlsx).
// GET /api/inventory/movements/export?locationType=location&locationId=xxx&type=...&from=...&to=...

export async function GET(req: NextRequest) {
  const guard = await inventoryGuard("inventory.view");
  if (guard instanceof NextResponse) return guard;
  const { organizationId } = guard;

  const locationType = (req.nextUrl.searchParams.get("locationType") ?? "location") as $Enums.LocationType;
  const locationId = req.nextUrl.searchParams.get("locationId") ?? "";
  if (!locationId) {
    return NextResponse.json({ ok: false, error: "Falta la ubicación" }, { status: 400 });
  }

  try {
    const { buffer, filename } = await exportMovementsXlsx(organizationId, {
      locationType,
      locationId,
      q: req.nextUrl.searchParams.get("q") ?? undefined,
      type: req.nextUrl.searchParams.get("type") ?? undefined,
      from: req.nextUrl.searchParams.get("from") ?? undefined,
      to: req.nextUrl.searchParams.get("to") ?? undefined,
    });
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return inventoryErrorResponse(err);
  }
}
