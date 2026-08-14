import { NextRequest, NextResponse } from "next/server";
import { inventoryGuard, inventoryErrorResponse } from "../../../../guard";
import { setRevisionItemCount } from "@/lib/inventory/server";

// FASE 8.5 — Actualiza el conteo de un ítem (manual o escaneado) en una revisión.

export async function PATCH(req: NextRequest) {
  const guard = await inventoryGuard("inventory.revision");
  if (guard instanceof NextResponse) return guard;
  const { organizationId, userId } = guard;

  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  const revisionId = parts[parts.length - 3];
  const itemId = parts[parts.length - 1];

  try {
    const body = (await req.json()) as { countedQuantity?: number; scanned?: boolean };
    const counted = Number(body.countedQuantity);
    if (!Number.isFinite(counted) || counted < 0) {
      return NextResponse.json({ ok: false, error: "Cantidad inválida" }, { status: 400 });
    }
    const result = await setRevisionItemCount(organizationId, userId, revisionId, itemId, {
      countedQuantity: counted,
      scanned: Boolean(body.scanned),
    });
    return NextResponse.json(result);
  } catch (err) {
    return inventoryErrorResponse(err);
  }
}