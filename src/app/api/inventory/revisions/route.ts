import { NextRequest, NextResponse } from "next/server";
import type { $Enums } from "@prisma/client";
import { inventoryGuard, inventoryErrorResponse } from "../guard";
import { listRevisions, createRevision } from "@/lib/inventory/server";

// FASE 8.5 — Revisiones físicas de inventario: listado (GET) y creación (POST).

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
    const result = await listRevisions(organizationId, {
      locationType,
      locationId,
      page: Number(req.nextUrl.searchParams.get("page")) || 1,
      pageSize: Number(req.nextUrl.searchParams.get("pageSize")) || 20,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return inventoryErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  const guard = await inventoryGuard("inventory.revision");
  if (guard instanceof NextResponse) return guard;
  const { organizationId, userId } = guard;

  try {
    const body = (await req.json()) as {
      locationType?: $Enums.LocationType;
      locationId?: string;
      notes?: string;
    };
    if (!body.locationId) {
      return NextResponse.json({ ok: false, error: "Falta la ubicación" }, { status: 400 });
    }
    const revision = await createRevision(
      organizationId,
      userId,
      {
        locationType: body.locationType ?? "location",
        locationId: body.locationId,
        notes: body.notes,
      }
    );
    return NextResponse.json({ ok: true, revision }, { status: 201 });
  } catch (err) {
    return inventoryErrorResponse(err);
  }
}