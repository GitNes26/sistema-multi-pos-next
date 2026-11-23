import type { PosProduct, PosVariant } from "@/types/pos"

/** Una presentación se puede vender: activa, no pausada y, si controla inventario, con existencia. */
export function variantSellable(variant: PosVariant, trackInventory: boolean): boolean {
  return variant.isActive && variant.isAvailable !== false && (!trackInventory || variant.stock > 0)
}

/**
 * ¿Se bloquea el producto completo («Ya no hay»)? Con varias presentaciones solo cuando NINGUNA se puede
 * vender: si falta una, se abre el selector y ahí se bloquea solo la agotada.
 */
export function posProductBlocked(product: PosProduct): boolean {
  if (!product.isAvailable) return true
  if (!product.trackInventory) return false
  if (product.variants.length > 1) return !product.variants.some((v) => variantSellable(v, true))
  return product.stock <= 0
}
