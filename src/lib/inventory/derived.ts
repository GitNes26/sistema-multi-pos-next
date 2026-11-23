import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { loadRecipeRows } from "@/lib/inventory/recipes"
import { recipeManagedVariants } from "@/lib/inventory/recipe-stock"

// Presentaciones «derivadas»: se venden DE otra variante del mismo producto por receta (rebanada → pastel
// entero). No guardan existencia propia: la existencia real vive en la variante base. Por eso no deben
// contarse como un registro más de inventario (listas, exportaciones, reportes, revisiones, reorden, traslados).
// Una fila derivada con cantidad distinta de 0 (datos anteriores) SÍ se conserva para no esconder existencias.

type Client = Prisma.TransactionClient | typeof prisma

/** Ids de variantes derivadas de la empresa (vacío si ninguna receta liga presentaciones entre sí). */
export async function derivedVariantIds(client: Client, organizationId: string, productIds?: string[]): Promise<Set<string>> {
  const recipeRows = await loadRecipeRows(client, organizationId, productIds)
  const hidden = new Set<string>()
  if (!recipeRows.length) return hidden
  const recipeProductIds = [...new Set(recipeRows.map((r) => r.productId))]
  const products = await client.product.findMany({
    where: { organizationId, id: { in: recipeProductIds } },
    select: { id: true, trackInventory: true, variants: { where: { isActive: true }, select: { id: true } } },
  })
  for (const product of products) {
    const variantIds = product.variants.map((v) => v.id)
    const own = new Set(variantIds)
    const productRows = recipeRows.filter((r) => r.productId === product.id && r.ingredientVariantId)
    // Variantes que sirven de insumo de otra presentación del mismo producto (la base).
    const bases = new Set(productRows.filter((r) => own.has(r.ingredientVariantId as string)).map((r) => r.ingredientVariantId as string))
    // Presentación que se vende «de» otra variante del mismo producto.
    for (const r of productRows) {
      if (r.variantId && r.variantId !== r.ingredientVariantId && own.has(r.ingredientVariantId as string)) hidden.add(r.variantId)
    }
    // Todas las presentaciones con receta propia: solo queda visible la base.
    const managed = recipeManagedVariants(recipeRows, { id: product.id, trackInventory: product.trackInventory, variantIds })
    for (const variantId of managed) if (!bases.has(variantId)) hidden.add(variantId)
    for (const base of bases) hidden.delete(base)
  }
  return hidden
}

/** Quita las filas derivadas sin existencia propia. */
export function withoutDerived<T extends { variantId?: string | null; quantity: unknown }>(rows: T[], hidden: Set<string>): T[] {
  if (!hidden.size) return rows
  return rows.filter((r) => !(r.variantId && hidden.has(r.variantId) && Number(r.quantity) === 0))
}
