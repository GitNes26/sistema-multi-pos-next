import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { StockShortageError, type StockShortage } from "@/lib/inventory/stock-errors"
import { recipeManagedVariants, type RecipeRowLite } from "@/lib/inventory/recipe-stock"
import {
  parseRecipeVariantSelections,
  resolveRecipeIngredientVariant,
} from "@/lib/inventory/recipe-selection"

type RecipeTotal = { productId: string | null; variantId: string | null; quantity: number; soldProductIds: Set<string> }

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
  // Una presentación sí puede descontarse de OTRA variante del mismo producto (pastel: la rebanada gasta 0.1
  // del «Completo»). Lo que no tiene sentido es consumirse a sí misma en la receta de insumos de otra cosa.
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
  const generalIngredientIds = [...new Set(recipes.map((recipe) => recipe.ingredientProductId).filter((id): id is string => Boolean(id)))]
  const generalVariants = generalIngredientIds.length
    ? await tx.productVariant.findMany({
        where: { organizationId, productId: { in: generalIngredientIds }, isActive: true, isAvailable: true },
        select: { id: true, productId: true },
      })
    : []
  const variantsByProduct = new Map<string, { id: string }[]>()
  for (const variant of generalVariants) {
    const list = variantsByProduct.get(variant.productId) ?? []
    list.push(variant)
    variantsByProduct.set(variant.productId, list)
  }
  const totals = new Map<string, RecipeTotal>()
  for (const sold of items) {
    const valueIds = new Set(
      (sold.selectedOptions ?? []).flatMap(
        (option) =>
          option.valueIds ?? option.values?.map((value) => value.id) ?? []
      )
    )
    const recipeVariantSelections = parseRecipeVariantSelections(valueIds)
    for (const recipe of recipes) {
      if (recipe.productId !== sold.productId) continue
      if (recipe.variantId && recipe.variantId !== sold.variantId) continue
      if (recipe.optionValueId && !valueIds.has(recipe.optionValueId)) continue
      let resolvedIngredientVariantId = recipe.ingredientVariantId
      let resolvedIngredientProductId = recipe.ingredientProductId
      if (!resolvedIngredientVariantId && resolvedIngredientProductId) {
        const candidates = variantsByProduct.get(resolvedIngredientProductId) ?? []
        const selectedId = resolveRecipeIngredientVariant(
          recipe.id,
          candidates.map((candidate) => candidate.id),
          recipeVariantSelections
        )
        if (selectedId) {
          resolvedIngredientVariantId = selectedId
          resolvedIngredientProductId = null
        }
      }
      const key = resolvedIngredientVariantId ?? resolvedIngredientProductId
      if (!key) continue
      const required =
        Number(recipe.quantity) *
        sold.quantity *
        (1 + Number(recipe.wastePercent) / 100)
      const current = totals.get(key)
      totals.set(key, {
        productId: resolvedIngredientProductId,
        variantId: resolvedIngredientVariantId,
        quantity: (current?.quantity ?? 0) + required,
        soldProductIds: new Set([...(current?.soldProductIds ?? []), sold.productId]),
      })
    }
  }
  // Primero se revisa TODO lo que falta y se avisa de una vez, con nombres y cantidades,
  // en lugar de detenerse en el primer insumo que no alcanza.
  const prepared: { ingredient: RecipeTotal; inventoryId: string; required: number }[] = []
  const shortages: StockShortage[] = []
  const soldNames = new Map(
    (await tx.product.findMany({ where: { organizationId, id: { in: productIds } }, select: { id: true, name: true } })).map((p) => [p.id, p.name] as const)
  )
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
    const required = Math.round(ingredient.quantity * 1000) / 1000
    const available = inventory ? Number(inventory.quantity) : 0
    if (!inventory || available < required) {
      const name = ingredient.variantId
        ? await tx.productVariant.findUnique({ where: { id: ingredient.variantId }, select: { name: true, product: { select: { name: true } } } }).then((v) => (v ? (v.name && v.name !== "Default" ? `${v.product.name} · ${v.name}` : v.product.name) : "Insumo"))
        : await tx.product.findUnique({ where: { id: ingredient.productId! }, select: { name: true } }).then((p) => p?.name ?? "Insumo")
      shortages.push({
        name,
        needed: required,
        available,
        kind: "ingredient",
        noRecord: !inventory,
        usedFor: [...ingredient.soldProductIds].map((id) => soldNames.get(id) ?? "").filter(Boolean),
      })
      continue
    }
    prepared.push({ ingredient, inventoryId: inventory.id, required })
  }
  if (shortages.length) throw new StockShortageError(shortages)
  for (const { ingredient, inventoryId, required } of prepared) {
    const updated = await tx.inventory.updateMany({
      where: { id: inventoryId, quantity: { gte: required } },
      data: { quantity: { decrement: required } },
    })
    if (updated.count !== 1) {
      // Otra venta se llevó la existencia entre la revisión y el descuento.
      const row = await tx.inventory.findUnique({ where: { id: inventoryId }, select: { quantity: true } })
      throw new StockShortageError([{ name: "Un insumo de la receta", needed: required, available: Number(row?.quantity ?? 0), kind: "ingredient", usedFor: [...ingredient.soldProductIds].map((id) => soldNames.get(id) ?? "").filter(Boolean) }])
    }
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

/** Renglones de receta en el formato que usa `recipe-stock` (cantidades como número). */
export async function loadRecipeRows(
  client: Prisma.TransactionClient | typeof prisma,
  organizationId: string,
  productIds?: string[]
): Promise<RecipeRowLite[]> {
  const rows = await client.productRecipeItem.findMany({
    where: { organizationId, ...(productIds ? { productId: { in: productIds } } : {}) },
    select: { productId: true, variantId: true, optionValueId: true, ingredientProductId: true, ingredientVariantId: true, quantity: true, wastePercent: true },
  })
  return rows.map((row) => ({ ...row, quantity: Number(row.quantity), wastePercent: Number(row.wastePercent) }))
}

/**
 * Renglones del ticket/pedido que se venden «de» una receta (clave `productId|variantId`): no tienen existencia propia,
 * así que no se validan ni se descuentan directamente; la receta se encarga y avisa si el insumo no alcanza.
 */
export async function recipeManagedItemKeys(
  client: Prisma.TransactionClient | typeof prisma,
  organizationId: string,
  items: { productId?: string | null; variantId?: string | null }[]
): Promise<Set<string>> {
  const productIds = [...new Set(items.filter((item) => item.productId && item.variantId).map((item) => item.productId as string))]
  const keys = new Set<string>()
  if (!productIds.length) return keys
  const [rows, products] = await Promise.all([
    loadRecipeRows(client, organizationId, productIds),
    client.product.findMany({
      where: { organizationId, id: { in: productIds } },
      select: { id: true, trackInventory: true, variants: { where: { isActive: true }, select: { id: true } } },
    }),
  ])
  for (const product of products) {
    const managed = recipeManagedVariants(rows, { id: product.id, trackInventory: product.trackInventory, variantIds: product.variants.map((v) => v.id) })
    for (const variantId of managed) keys.add(`${product.id}|${variantId}`)
  }
  return keys
}
