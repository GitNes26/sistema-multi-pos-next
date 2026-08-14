import { NextRequest, NextResponse } from "next/server";
import { inventoryGuard, inventoryErrorResponse } from "../guard";
import { setMinThreshold } from "@/lib/inventory/server";

// FASE 8.3 — Stock mínimo (umbral de alerta) de una fila de inventario.

export async function POST(req: NextRequest) {
  const guard = await inventoryGuard("inventory.manage");
  if (guard instanceof NextResponse) return guard;
  const { organizationId } = guard;

  try {
    const body = (await req.json()) as { inventoryId?: string; minThreshold?: number };
    if (!body.inventoryId) {
      return NextResponse.json({ ok: false, error: "Falta el registro de inventario" }, { status: 400 });
    }
    const value = await setMinThreshold(organizationId, body.inventoryId, Number(body.minThreshold) || 0);
    return NextResponse.json({ ok: true, minThreshold: value });
  } catch (err) {
    return inventoryErrorResponse(err);
  }
}