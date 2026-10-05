import type { ShoppingListView } from "@/lib/portal/server"

/** Renglón de una lista de compras mientras se arma (antes de guardarse). */
export interface DraftItem {
  id?: string
  variantId: string | null
  productId: string
  unitId: string | null
  unitAbbrev: string | null
  step: number
  productName: string
  variantName: string | null
  price: number
  quantity: number
}

export const itemKey = (i: Pick<DraftItem, "variantId" | "productId" | "unitId">) =>
  i.variantId ? `v:${i.variantId}` : `b:${i.productId}:${i.unitId}`

export const toDraft = (i: ShoppingListView["items"][number]): DraftItem => ({
  id: i.id,
  variantId: i.variantId,
  productId: i.productId,
  unitId: i.unitId,
  unitAbbrev: i.unitAbbrev,
  step: i.step,
  productName: i.productName,
  variantName: i.variantName,
  price: i.price,
  quantity: i.quantity,
})

export const toPayload = (items: DraftItem[]) =>
  items.map((i) => ({ variantId: i.variantId, productId: i.variantId ? null : i.productId, unitId: i.unitId, quantity: i.quantity }))
