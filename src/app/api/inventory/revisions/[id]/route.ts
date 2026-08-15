import { NextRequest, NextResponse } from "next/server";
import { inventoryGuard, inventoryErrorResponse } from "../../guard";
import { getRevision, updateRevisionNotes } from "@/lib/inventory/server";

// FASE 8.5 — Detalle de una revisión física (GET) y actualización de notas (PATCH).

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

export async function PATCH(req: NextRequest) {
  const guard = await inventoryGuard("inventory.revision");
  if (guard instanceof NextResponse) return guard;
  const { organizationId } = guard;

  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  const id = parts[parts.length - 1];

  try {
    const body = (await req.json()) as { notes?: string | null };
    const result = await updateRevisionNotes(organizationId, id, body.notes ?? null);
    return NextResponse.json(result);
  } catch (err) {
    return inventoryErrorResponse(err);
  }
}
