import { NextRequest, NextResponse } from "next/server";
import { inventoryGuard, inventoryErrorResponse } from "../../../guard";
import { recordTransferLocation } from "@/lib/inventory/transfers";

// POST { lat, lng, accuracy? } — el teléfono del chofer reporta su posición
// mientras el traslado va en camino.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await inventoryGuard("transfers.dispatch");
  if (guard instanceof NextResponse) return guard;
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { lat?: number; lng?: number; accuracy?: number };
    if (typeof body.lat !== "number" || typeof body.lng !== "number") {
      return NextResponse.json({ ok: false, error: "lat y lng requeridos" }, { status: 400 });
    }
    return NextResponse.json(await recordTransferLocation(guard.organizationId, id, { lat: body.lat, lng: body.lng, accuracy: body.accuracy ?? null }));
  } catch (err) {
    return inventoryErrorResponse(err);
  }
}
