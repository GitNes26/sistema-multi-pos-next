import { NextRequest, NextResponse } from "next/server"
import { inventoryGuard, inventoryErrorResponse } from "../../guard"
import {
  getProductRecipe,
  replaceProductRecipe,
  type RecipeInput,
} from "@/lib/inventory/recipes"

export async function GET(req: NextRequest) {
  const guard = await inventoryGuard("inventory.view")
  if (guard instanceof NextResponse) return guard
  try {
    const productId = req.nextUrl.pathname.split("/").filter(Boolean).at(-1)!
    return NextResponse.json({
      ok: true,
      items: await getProductRecipe(guard.organizationId, productId),
    })
  } catch (error) {
    return inventoryErrorResponse(error)
  }
}
export async function PUT(req: NextRequest) {
  const guard = await inventoryGuard("inventory.manage")
  if (guard instanceof NextResponse) return guard
  try {
    const productId = req.nextUrl.pathname.split("/").filter(Boolean).at(-1)!
    const body = (await req.json()) as { items?: RecipeInput[] }
    await replaceProductRecipe(
      guard.organizationId,
      productId,
      Array.isArray(body.items) ? body.items : []
    )
    return NextResponse.json({ ok: true })
  } catch (error) {
    return inventoryErrorResponse(error)
  }
}
