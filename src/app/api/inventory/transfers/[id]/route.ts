import { NextRequest, NextResponse } from "next/server";
import { inventoryGuard, inventoryErrorResponse } from "../../guard";
import {
  cancelTransfer,
  dispatchTransfer,
  getTransfer,
  receiveTransfer,
  startPreparing,
} from "@/lib/inventory/transfers";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const guard = await inventoryGuard("inventory.view");
  if (guard instanceof NextResponse) return guard;
  try {
    const { id } = await params;
    return NextResponse.json({ ok: true, transfer: await getTransfer(guard.organizationId, id) });
  } catch (err) {
    return inventoryErrorResponse(err);
  }
}

// POST { action: "prepare" | "dispatch" | "receive" | "cancel", ... }
export async function POST(req: NextRequest, { params }: Ctx) {
  const guard = await inventoryGuard("inventory.manage");
  if (guard instanceof NextResponse) return guard;
  const { organizationId, userId } = guard;
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    switch (body.action) {
      case "prepare":
        return NextResponse.json(await startPreparing(organizationId, id));
      case "dispatch":
        return NextResponse.json(
          await dispatchTransfer(organizationId, id, userId, {
            driverName: typeof body.driverName === "string" ? body.driverName : null,
            vehicle: typeof body.vehicle === "string" ? body.vehicle : null,
            expectedAt: typeof body.expectedAt === "string" ? body.expectedAt : null,
            quantities: (body.quantities as Record<string, number> | undefined) ?? undefined,
          })
        );
      case "receive":
        return NextResponse.json(
          await receiveTransfer(organizationId, id, userId, {
            items: Array.isArray(body.items) ? (body.items as { itemId: string; receivedQty: number; note?: string }[]) : [],
            notes: typeof body.notes === "string" ? body.notes : null,
          })
        );
      case "cancel":
        return NextResponse.json(await cancelTransfer(organizationId, id, userId, typeof body.reason === "string" ? body.reason : null));
      default:
        return NextResponse.json({ ok: false, error: "Acción desconocida" }, { status: 400 });
    }
  } catch (err) {
    return inventoryErrorResponse(err);
  }
}
