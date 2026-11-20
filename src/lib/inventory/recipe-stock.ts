// Existencia «derivada» de una receta: una presentación que no guarda existencias propias, sino que se
// vende «de» otro inventario. Ejemplos:
//  - Pastel con variantes «Completo» (gasta 1 del pastel) y «Rebanada» (gasta 0.1 del mismo pastel).
//  - «Rebanada de pastel» como producto aparte que gasta 0.1 de «Pastel» (sin control de inventario propio).
// Con esto el catálogo del POS y del portal sabe cuántas piezas se pueden vender y marca agotado cuando el
// insumo se acaba, y el servidor sabe que NO debe descontar la existencia propia de esa presentación.
// Módulo puro (sin base de datos).

export interface RecipeRowLite {
  productId: string
  variantId: string | null
  optionValueId: string | null
  ingredientProductId: string | null
  ingredientVariantId: string | null
  quantity: number
  wastePercent: number
}

export interface RecipeProductLite {
  id: string
  trackInventory: boolean
  /** Variantes activas del producto. */
  variantIds: string[]
}

/** Renglones que se aplican siempre a esa presentación y cuyo insumo es una variante concreta (calculables). */
function computableRows(rows: RecipeRowLite[], productId: string, variantId: string): RecipeRowLite[] {
  return rows.filter(
    (row) =>
      row.productId === productId &&
      !row.optionValueId &&
      Boolean(row.ingredientVariantId) &&
      (row.variantId == null || row.variantId === variantId)
  )
}

/** Piezas que se pueden vender con el insumo disponible (el insumo que más limita manda). */
export function sellableUnits(rows: RecipeRowLite[], productId: string, variantId: string, stockOfVariant: (variantId: string) => number): number | null {
  const applicable = computableRows(rows, productId, variantId)
  if (!applicable.length) return null
  let units = Infinity
  for (const row of applicable) {
    const perUnit = row.quantity * (1 + row.wastePercent / 100)
    if (!(perUnit > 0)) continue
    units = Math.min(units, Math.floor(stockOfVariant(row.ingredientVariantId!) / perUnit + 1e-9))
  }
  return Number.isFinite(units) ? Math.max(0, units) : null
}

/**
 * Presentaciones del producto que se venden «de» su receta. Solo si TODAS las activas son calculables:
 * si una queda con existencia propia, el producto conserva su comportamiento de siempre.
 * Un producto con control de inventario solo se deriva si se descuenta de una variante de sí mismo.
 */
export function recipeManagedVariants(rows: RecipeRowLite[], product: RecipeProductLite): Set<string> {
  const managed = new Set<string>()
  if (!product.variantIds.length) return managed
  const own = new Set(product.variantIds)
  for (const variantId of product.variantIds) {
    const applicable = computableRows(rows, product.id, variantId)
    if (!applicable.length) return new Set()
    const selfBased = applicable.some((row) => own.has(row.ingredientVariantId!))
    if (product.trackInventory && !selfBased) return new Set()
    managed.add(variantId)
  }
  return managed
}
