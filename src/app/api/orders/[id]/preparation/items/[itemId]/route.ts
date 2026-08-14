import { NextResponse } from "next/server";
import { setPreparationItem } from "@/lib/orders/server";
import { ordersGuard, ordersErrorResponse } from "../../../../guard";

// FASE 12.3 — Item del checklist de preparación: escaneado / encontrado / notas.

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const guard = await ordersGuard("orders.manage");
  if (guard instanceof NextResponse) return guard;
  const { itemId } = await params;

  try {
    const body = (await req.json()) as {
      found?: boolean;
      scanned?: boolean;
      notes?: string | null;
    };
    const item = await setPreparationItem(guard.organizationId, itemId, {
      found: body.found,
      scanned: body.scanned,
      notes: body.notes,
    });
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    return ordersErrorResponse(err);
  }
}