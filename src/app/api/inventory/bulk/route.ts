import { NextResponse } from "next/server"
import { inventoryGuard, inventoryErrorResponse } from "../guard"
import { bulkUpdateInventory } from "@/lib/inventory/server"

export async function POST(request: Request) {
  const guard = await inventoryGuard("inventory.manage")
  if (guard instanceof NextResponse) return guard
  try {
    const body = await request.json() as { rows?: { inventoryId: string; quantity: number; minThreshold: number }[] }
    const result = await bulkUpdateInventory(guard.organizationId, guard.userId, body.rows ?? [])
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return inventoryErrorResponse(error)
  }
}
