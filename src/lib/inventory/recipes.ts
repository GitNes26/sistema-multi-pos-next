import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"

export interface RecipeInput {
  variantId?: string | null
  optionValueId?: string | null
  ingredientProductId?: string | null
  ingredientVariantId?: string | null
  quantity: number
  wastePercent?: number
}

export async function getProductRecipe(
  organizationId: string,
  productId: string
) {
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId },
    select: { id: true },
  })
  if (!product) throw new Error("Producto no encontrado")
  const items = await prisma.productRecipeItem.findMany({
    where: { organizationId, productId },
    orderBy: { createdAt: "asc" },
  })
  const productIds = [
    ...new Set(
      items
        .map((item) => item.ingredientProductId)
        .filter((id): id is string => Boolean(id))
    ),
  ]
  const variantIds = [
    ...new Set(
      items
        .map((item) => item.ingredientVariantId)
        .filter((id): id is string => Boolean(id))
    ),
  ]
  const [products, variants] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId, id: { in: productIds } },
      select: { id: true, name: true },
    }),
    prisma.productVariant.findMany({
      where: { organizationId, id: { in: variantIds } },
      select: { id: true, name: true, product: { select: { name: true } } },
    }),
  ])
  const names = new Map([
    ...products.map((row) => [row.id, row.name] as const),
    ...variants.map(
      (row) => [row.id, `${row.product.name} · ${row.name}`] as const
    ),
  ])
  return items.map((item) => ({
    ...item,
    quantity: Number(item.quantity),
    wastePercent: Number(item.wastePercent),
    ingredientName:
      names.get(item.ingredientVariantId ?? item.ingredientProductId ?? "") ??
      "Ingrediente",
  }))
}

export async function replaceProductRecipe(
  organizationId: string,
  productId: string,
  items: RecipeInput[]
) {
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId },
    select: { id: true },
  })
  if (!product) throw new Error("Producto no encontrado")
  for (const item of items) {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0)
      throw new Error("Cada consumo debe ser mayor a cero")
    if (Boolean(item.ingredientProductId) === Boolean(item.ingredientVariantId))
      throw new Error("Selecciona un solo ingrediente por renglón")
    if (item.variantId && item.optionValueId)
      throw new Error("Selecciona una sola condición por renglón")
    if (item.ingredientProductId === productId)
      throw new Error("Un producto no puede consumirse a sí mismo")
  }
  const ingredientProducts = items
    .map((item) => item.ingredientProductId)
    .filter((id): id is string => Boolean(id))
  const ingredientVariants = items
    .map((item) => item.ingredientVariantId)
    .filter((id): id is string => Boolean(id))
  const sourceVariants = items
    .map((item) => item.variantId)
    .filter((id): id is string => Boolean(id))
  const sourceOptionValues = items
    .map((item) => item.optionValueId)
    .filter((id): id is string => Boolean(id))
  const [
    productCount,
    variantRows,
    sourceVariantCount,
    sourceOptionValueCount,
  ] = await Promise.all([
    prisma.product.count({
      where: {
        organizationId,
        id: { in: ingredientProducts },
        trackInventory: true,
      },
    }),
    prisma.productVariant.findMany({
      where: {
        organizationId,
        id: { in: ingredientVariants },
        product: { trackInventory: true },
      },
      select: { id: true, productId: true },
    }),
    prisma.productVariant.count({
      where: { organizationId, productId, id: { in: sourceVariants } },
    }),
    prisma.productOptionValue.count({
      where: { id: { in: sourceOptionValues }, option: { productId } },
    }),
  ])
  if (
    productCount !== new Set(ingredientProducts).size ||
    variantRows.length !== new Set(ingredientVariants).size ||
    sourceVariantCount !== new Set(sourceVariants).size ||
    sourceOptionValueCount !== new Set(sourceOptionValues).size
  )
    throw new Error(
      "Los ingredientes deben pertenecer a la empresa y controlar inventario"
    )
  if (variantRows.some((variant) => variant.productId === productId))
    throw new Error("Un producto no puede consumirse a sí mismo")
  await prisma.$transaction(async (tx) => {
    await tx.productRecipeItem.deleteMany({
      where: { organizationId, productId },
    })
    if (items.length)
      await tx.productRecipeItem.createMany({
        data: items.map((item) => ({
          organizationId,
          productId,
          variantId: item.variantId || null,
          optionValueId: item.optionValueId || null,
          ingredientProductId: item.ingredientProductId || null,
          ingredientVariantId: item.ingredientVariantId || null,
          quantity: item.quantity,
          wastePercent: Math.max(0, Math.min(100, item.wastePercent ?? 0)),
        })),
      })
  })
}

export async function consumeRecipeIngredients(
  tx: Prisma.TransactionClient,
  organizationId: string,
  locationId: string,
  referenceId: string,
  userId: string | null,
  items: {
    productId: string
    variantId?: string | null
    quantity: number
    selectedOptions?: { valueIds?: string[]; values?: { id: string }[] }[]
  }[]
) {
  const productIds = [...new Set(items.map((item) => item.productId))]
  const recipes = await tx.productRecipeItem.findMany({
    where: { organizationId, productId: { in: productIds } },
  })
  if (!recipes.length) return
  const totals = new Map<
    string,
    { productId: string | null; variantId: string | null; quantity: number }
  >()
  for (const sold of items) {
    const valueIds = new Set(
      (sold.selectedOptions ?? []).flatMap(
        (option) =>
          option.valueIds ?? option.values?.map((value) => value.id) ?? []
      )
    )
    for (const recipe of recipes) {
      if (recipe.productId !== sold.productId) continue
      if (recipe.variantId && recipe.variantId !== sold.variantId) continue
      if (recipe.optionValueId && !valueIds.has(recipe.optionValueId)) continue
      const key = recipe.ingredientVariantId ?? recipe.ingredientProductId
      if (!key) continue
      const required =
        Number(recipe.quantity) *
        sold.quantity *
        (1 + Number(recipe.wastePercent) / 100)
      const current = totals.get(key)
      totals.set(key, {
        productId: recipe.ingredientProductId,
        variantId: recipe.ingredientVariantId,
        quantity: (current?.quantity ?? 0) + required,
      })
    }
  }
  for (const ingredient of totals.values()) {
    const inventory = await tx.inventory.findFirst({
      where: {
        organizationId,
        locationId,
        locationType: "location",
        ...(ingredient.variantId
          ? { variantId: ingredient.variantId }
          : { productId: ingredient.productId }),
      },
    })
    if (!inventory)
      throw new Error("Falta registrar inventario para un insumo de la receta")
    const required = Math.round(ingredient.quantity * 1000) / 1000
    const updated = await tx.inventory.updateMany({
      where: { id: inventory.id, quantity: { gte: required } },
      data: { quantity: { decrement: required } },
    })
    if (updated.count !== 1)
      throw new Error("Insumos insuficientes para preparar la venta")
    await tx.inventoryMovement.create({
      data: {
        organizationId,
        locationId,
        locationType: "location",
        productId: ingredient.variantId ? null : ingredient.productId,
        variantId: ingredient.variantId,
        quantity: -required,
        type: "sale",
        reason: "Consumo por receta",
        referenceId,
        userId,
      },
    })
  }
}

export async function restoreRecipeIngredients(
  tx: Prisma.TransactionClient,
  organizationId: string,
  referenceId: string,
  userId: string | null
) {
  const movements = await tx.inventoryMovement.findMany({
    where: {
      organizationId,
      referenceId,
      reason: "Consumo por receta",
      quantity: { lt: 0 },
    },
  })
  for (const movement of movements) {
    const alreadyRestored = await tx.inventoryMovement.findFirst({
      where: {
        organizationId,
        referenceId,
        reason: "Reintegro de receta por cancelación",
        productId: movement.productId,
        variantId: movement.variantId,
      },
      select: { id: true },
    })
    if (alreadyRestored) continue
    const quantity = Math.abs(Number(movement.quantity))
    const inventory = await tx.inventory.findFirst({
      where: {
        organizationId,
        locationId: movement.locationId,
        locationType: movement.locationType,
        productId: movement.productId,
        variantId: movement.variantId,
      },
      select: { id: true },
    })
    if (inventory)
      await tx.inventory.update({
        where: { id: inventory.id },
        data: { quantity: { increment: quantity } },
      })
    await tx.inventoryMovement.create({
      data: {
        organizationId,
        locationId: movement.locationId,
        locationType: movement.locationType,
        productId: movement.productId,
        variantId: movement.variantId,
        quantity,
        type: "return",
        reason: "Reintegro de receta por cancelación",
        referenceId,
        userId,
      },
    })
  }
}
