import { NextRequest, NextResponse } from "next/server";
import type { $Enums } from "@prisma/client";
import { inventoryGuard, inventoryErrorResponse } from "../guard";
import { importInventoryStock } from "@/lib/inventory/server";

// FASE 8.6 — Importación masiva de existencias desde Excel (.xlsx).
// Columnas: SKU | Código de barras | Nombre (granel) | Cantidad.

const MAX_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const guard = await inventoryGuard("inventory.manage");
  if (guard instanceof NextResponse) return guard;
  const { organizationId, userId } = guard;

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Envía el campo «file» con tu .xlsx" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ ok: false, error: "El archivo excede 10 MB" }, { status: 413 });
    }
    const locationType = (String(form.get("locationType") ?? "location")) as $Enums.LocationType;
    const locationId = String(form.get("locationId") ?? "");
    if (!locationId) {
      return NextResponse.json({ ok: false, error: "Falta la ubicación" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importInventoryStock(organizationId, userId, {
      locationType,
      locationId,
      buffer,
    });
    return NextResponse.json({ ok: result.ok, result });
  } catch (err) {
    return inventoryErrorResponse(err);
  }
}