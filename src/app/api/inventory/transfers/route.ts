import { NextRequest, NextResponse } from "next/server";
import type { $Enums } from "@prisma/client";
import { inventoryGuard, inventoryErrorResponse } from "../guard";
import { transferStock } from "@/lib/inventory/server";

// FASE 8.8 — Transferencia de stock entre sucursales/CEDIS.

export async function POST(req: NextRequest) {
  const guard = await inventoryGuard("inventory.manage");
  if (guard instanceof NextResponse) return guard;
  const { organizationId, userId } = guard;

  try {
    const body = (await req.json()) as {
      fromInventoryId?: string;
      toLocationType?: $Enums.LocationType;
      toLocationId?: string;
      quantity?: number;
      reason?: string;
    };
    if (!body.fromInventoryId || !body.toLocationType || !body.toLocationId || !body.quantity) {
      return NextResponse.json({ ok: false, error: "Faltan datos de la transferencia" }, { status: 400 });
    }
    const result = await transferStock(
      organizationId,
      {
        fromInventoryId: body.fromInventoryId,
        toLocationType: body.toLocationType,
        toLocationId: body.toLocationId,
        quantity: body.quantity,
        reason: body.reason,
      },
      userId
    );
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return inventoryErrorResponse(err);
  }
}