export interface BulkPricingProduct {
  bulkUnitId: string | null
  bulkPricePerUnit: number
  allowSplit: boolean
  splitUnitId: string | null
  splitPricePerUnit: number
}

/** Devuelve el precio autorizado para la presentación a granel elegida. */
export function resolveBulkUnitPrice(product: BulkPricingProduct, unitId?: string | null) {
  if (unitId && unitId === product.bulkUnitId) return product.bulkPricePerUnit
  if (
    unitId &&
    product.allowSplit &&
    product.splitUnitId &&
    unitId === product.splitUnitId &&
    product.splitPricePerUnit > 0
  ) {
    return product.splitPricePerUnit
  }
  throw new Error("La unidad seleccionada no está disponible para este producto")
}
