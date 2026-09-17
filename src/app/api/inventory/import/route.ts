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
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json({ ok: false, error: "Selecciona un archivo Excel .xlsx" }, { status: 415 });
    }
    const locationType = (String(form.get("locationType") ?? "location")) as $Enums.LocationType;
    const locationId = String(form.get("locationId") ?? "");
    if (!locationId) {
      return NextResponse.json({ ok: false, error: "Falta la ubicación" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
      return NextResponse.json({ ok: false, error: "El archivo no es un Excel .xlsx válido" }, { status: 415 });
    }
    const preview = form.get("preview") === "true";
    const params = {
      locationType,
      locationId,
      buffer,
    };
    const checked = await importInventoryStock(organizationId, userId, { ...params, preview: true });
    const result = preview || checked.errors.length ? checked : await importInventoryStock(organizationId, userId, params);
    return NextResponse.json({ ok: result.ok, result });
  } catch (err) {
    return inventoryErrorResponse(err);
  }
}
