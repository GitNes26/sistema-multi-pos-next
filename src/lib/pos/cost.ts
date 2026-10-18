import type { Prisma } from "@prisma/client"

// Costo unitario de lo vendido, congelado en cada partida al cobrar. Sin esto
// la «ganancia» de los reportes sería igual a las ventas. Orden de preferencia:
// 1) costo de la variante, 2) costo por unidad del granel, 3) costo de la receta.

export interface CostLine {
  productId?: string | null
  variantId?: string | null
  unitId?: string | null
}

const n = (v: Prisma.Decimal | number | null | undefined) => (v == null ? 0 : Number(v))
const round2 = (v: number) => Math.round(v * 100) / 100

type Db = Pick<Prisma.TransactionClient, "productVariant" | "product" | "productRecipeItem">

/** Devuelve un costo unitario por cada partida (0 si no se conoce). */
export async function resolveUnitCosts(db: Db, organizationId: string, lines: CostLine[]): Promise<number[]> {
  const variantIds = [...new Set(lines.map((l) => l.variantId).filter((v): v is string => !!v))]
  const productIds = [...new Set(lines.map((l) => l.productId).filter((v): v is string => !!v))]

  const [variants, products] = await Promise.all([
    variantIds.length
      ? db.productVariant.findMany({ where: { id: { in: variantIds }, organizationId }, select: { id: true, productId: true, cost: true } })
      : Promise.resolve([]),
    productIds.length
      ? db.product.findMany({
          where: { id: { in: productIds }, organizationId },
          select: { id: true, productType: true, bulkUnitId: true, bulkCostPerUnit: true },
        })
      : Promise.resolve([]),
  ])
  const variantById = new Map(variants.map((v) => [v.id, v]))
  const productById = new Map(products.map((p) => [p.id, p]))

  const costs = lines.map((line) => {
    const variant = line.variantId ? variantById.get(line.variantId) : undefined
    if (variant && n(variant.cost) > 0) return round2(n(variant.cost))
    const product = line.productId ? productById.get(line.productId) : undefined
    if (product?.productType === "bulk" && n(product.bulkCostPerUnit) > 0 && (!line.unitId || line.unitId === product.bulkUnitId)) {
      return round2(n(product.bulkCostPerUnit))
    }
    return 0
  })

  // Receta: solo para lo que quedó sin costo.
  const pending = lines.map((l, i) => ({ l, i })).filter(({ i, l }) => costs[i] === 0 && (l.productId || l.variantId))
  if (pending.length) {
    const recipeProductIds = [...new Set(pending.map(({ l }) => l.productId ?? variantById.get(l.variantId ?? "")?.productId).filter((v): v is string => !!v))]
    const recipe = await db.productRecipeItem.findMany({
      where: { organizationId, productId: { in: recipeProductIds }, optionValueId: null },
      select: { productId: true, variantId: true, ingredientProductId: true, ingredientVariantId: true, quantity: true, wastePercent: true },
    })
    if (recipe.length) {
      const ingVariantIds = [...new Set(recipe.map((r) => r.ingredientVariantId).filter((v): v is string => !!v))]
      const ingProductIds = [...new Set(recipe.map((r) => r.ingredientProductId).filter((v): v is string => !!v))]
      const [ingVariants, ingProducts] = await Promise.all([
        ingVariantIds.length ? db.productVariant.findMany({ where: { id: { in: ingVariantIds }, organizationId }, select: { id: true, cost: true } }) : Promise.resolve([]),
        ingProductIds.length
          ? db.product.findMany({
              where: { id: { in: ingProductIds }, organizationId },
              select: { id: true, bulkCostPerUnit: true, variants: { where: { isActive: true }, orderBy: { createdAt: "asc" }, take: 1, select: { cost: true } } },
            })
          : Promise.resolve([]),
      ])
      const ingVariantCost = new Map(ingVariants.map((v) => [v.id, n(v.cost)]))
      const ingProductCost = new Map(ingProducts.map((p) => [p.id, n(p.bulkCostPerUnit) > 0 ? n(p.bulkCostPerUnit) : n(p.variants[0]?.cost)]))
      for (const { l, i } of pending) {
        const productId = l.productId ?? variantById.get(l.variantId ?? "")?.productId
        const items = recipe.filter((r) => r.productId === productId && (!r.variantId || r.variantId === l.variantId))
        if (!items.length) continue
        const total = items.reduce((sum, r) => {
          const unit = r.ingredientVariantId ? ingVariantCost.get(r.ingredientVariantId) ?? 0 : r.ingredientProductId ? ingProductCost.get(r.ingredientProductId) ?? 0 : 0
          return sum + unit * n(r.quantity) * (1 + n(r.wastePercent) / 100)
        }, 0)
        costs[i] = round2(total)
      }
    }
  }
  return costs
}
