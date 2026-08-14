import { NextRequest, NextResponse } from "next/server";
import { inventoryGuard, inventoryErrorResponse } from "../../../guard";
import { completeRevision, cancelRevision } from "@/lib/inventory/server";

// FASE 8.5 — Finalizar (POST complete) o cancelar (POST cancel) una revisión.

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; action: string }> }
) {
  const guard = await inventoryGuard("inventory.revision");
  if (guard instanceof NextResponse) return guard;
  const { organizationId, userId } = guard;
  const { id, action } = await context.params;

  try {
    const result =
      action === "complete"
        ? await completeRevision(organizationId, userId, id)
        : await cancelRevision(organizationId, id);
    return NextResponse.json(result);
  } catch (err) {
    return inventoryErrorResponse(err);
  }
}