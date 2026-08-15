import { NextRequest, NextResponse } from "next/server";
import type { $Enums } from "@prisma/client";
import { inventoryGuard, inventoryErrorResponse } from "../guard";
import { listMovements, registerMovement } from "@/lib/inventory/server";

// FASE 8.2 / 8.4 — Movimientos de inventario: historial (GET) y registro (POST).

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
    const result = await listMovements(organizationId, {
      locationType,
      locationId,
      q: req.nextUrl.searchParams.get("q") ?? undefined,
      type: req.nextUrl.searchParams.get("type") ?? undefined,
      from: req.nextUrl.searchParams.get("from") ?? undefined,
      to: req.nextUrl.searchParams.get("to") ?? undefined,
      page: Number(req.nextUrl.searchParams.get("page")) || 1,
      pageSize: Number(req.nextUrl.searchParams.get("pageSize")) || 20,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return inventoryErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  const guard = await inventoryGuard("inventory.manage");
  if (guard instanceof NextResponse) return guard;
  const { organizationId, userId } = guard;

  try {
    const body = (await req.json()) as {
      inventoryId?: string;
      type?: $Enums.MovementType;
      quantity?: number;
      reason?: string;
    };
    if (!body.inventoryId || !body.type || body.quantity === undefined) {
      return NextResponse.json({ ok: false, error: "Faltan datos del movimiento" }, { status: 400 });
    }
    const row = await registerMovement(
      organizationId,
      {
        inventoryId: body.inventoryId,
        type: body.type,
        quantity: body.quantity,
        reason: body.reason,
      },
      userId
    );
    return NextResponse.json({ ok: true, row }, { status: 201 });
  } catch (err) {
    return inventoryErrorResponse(err);
  }
}