import { NextRequest, NextResponse } from "next/server";
import type { $Enums } from "@prisma/client";
import { inventoryGuard, inventoryErrorResponse } from "../guard";
import { transferStock } from "@/lib/inventory/server";
import { createTransfer, listTransfers, type CreateTransferInput } from "@/lib/inventory/transfers";

// Traslados entre sucursales/CEDIS.
// GET  → lista (filtros: status=active|pending|…, locationId, q).
// POST → crea un traslado con flujo (items[]); el formato anterior
//        (fromInventoryId) sigue funcionando como transferencia inmediata.

export async function GET(req: NextRequest) {
  const guard = await inventoryGuard("transfers.view");
  if (guard instanceof NextResponse) return guard;
  try {
    const sp = req.nextUrl.searchParams;
    const rows = await listTransfers(guard.organizationId, {
      status: sp.get("status") || undefined,
      locationId: sp.get("locationId") || undefined,
      q: sp.get("q") || undefined,
    });
    return NextResponse.json({ ok: true, rows });
  } catch (err) {
    return inventoryErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  const guard = await inventoryGuard("transfers.request");
  if (guard instanceof NextResponse) return guard;
  const { organizationId, userId } = guard;

  try {
    const body = (await req.json()) as Partial<CreateTransferInput> & {
      fromInventoryId?: string;
      toLocationType?: $Enums.LocationType;
      toLocationId?: string;
      quantity?: number;
      reason?: string;
    };

    if (Array.isArray(body.items)) {
      if (!body.fromLocationId || !body.fromLocationType || !body.toLocationId || !body.toLocationType) {
        return NextResponse.json({ ok: false, error: "Elige el origen y el destino" }, { status: 400 });
      }
      const result = await createTransfer(organizationId, userId, body as CreateTransferInput);
      return NextResponse.json(result, { status: 201 });
    }

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
