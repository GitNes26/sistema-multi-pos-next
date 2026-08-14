import { NextRequest, NextResponse } from "next/server";
import { inventoryGuard, inventoryErrorResponse } from "../../guard";
import { getRevision } from "@/lib/inventory/server";

// FASE 8.5 — Detalle de una revisión física.

export async function GET(req: NextRequest) {
  const guard = await inventoryGuard("inventory.view");
  if (guard instanceof NextResponse) return guard;
  const { organizationId } = guard;

  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  const id = parts[parts.length - 1];

  try {
    const revision = await getRevision(organizationId, id);
    return NextResponse.json({ ok: true, revision });
  } catch (err) {
    return inventoryErrorResponse(err);
  }
}