import { prisma } from "@/lib/db"

// Conciliación del inventario de un producto con su forma vigente.
//
// Cada tipo de producto guarda su existencia en un lugar distinto:
//   • Estándar / personalizado → una fila por variante (la "Default" si no tiene otras).
//   • A granel                 → una sola fila a nivel producto (con su unidad de granel).
//
// Al cambiar el tipo (p. ej. estándar → granel) la fila anterior quedaba viva
// y el inventario mostraba el producto dos veces; el POS podía descontar de
// cualquiera de las dos. Esta función deja exactamente las filas que
// corresponden, suma lo que hubiera en las obsoletas y registra el ajuste.

const num = (v: unknown) => (v == null ? 0 : Number(v))

type Key = { variantId: string | null }

export async function reconcileProductInventory(organizationId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, organizationId },
    select: {
      id: true,
      productType: true,
      bulkUnitId: true,
      bulkPricePerUnit: true,
      variants: { where: { isActive: true }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } },
    },
  })
  if (!product) return { moved: 0 }

  // Estándar/personalizado sin variantes activas: garantizar la "Default".
  let variants = product.variants
  if (product.productType !== "bulk" && variants.length === 0) {
    const created = await prisma.productVariant.create({
      data: { productId, organizationId, name: "Default", price: num(product.bulkPricePerUnit), cost: 0, isActive: true },
      select: { id: true, name: true },
    })
    variants = [created]
  }

  // Unidad de la fila vigente: la de granel, o "pieza" para estándar/personalizado.
  const pza = product.productType === "bulk"
    ? null
    : await prisma.unitOfMeasure.findFirst({ where: { abbreviation: "pza", OR: [{ organizationId: null }, { organizationId }] }, select: { id: true } })
  const targetUnit = product.productType === "bulk" ? product.bulkUnitId : (pza?.id ?? null)

  const canonical: Key[] = product.productType === "bulk" ? [{ variantId: null }] : variants.map((v) => ({ variantId: v.id }))
  const isCanonical = (variantId: string | null) => canonical.some((k) => k.variantId === variantId)

  const rows = await prisma.inventory.findMany({
    where: { organizationId, OR: [{ productId }, { variant: { productId } }] },
    select: { id: true, locationId: true, locationType: true, variantId: true, quantity: true, minThreshold: true, unitId: true },
  })

  const byPlace = new Map<string, typeof rows>()
  for (const r of rows) {
    const key = `${r.locationType}:${r.locationId}`
    byPlace.set(key, [...(byPlace.get(key) ?? []), r])
  }

  let moved = 0
  for (const placeRows of byPlace.values()) {
    const stale = placeRows.filter((r) => !isCanonical(r.variantId))
    if (stale.length === 0) continue
    const { locationId, locationType } = stale[0]
    const target = canonical[0]
    const staleQty = stale.reduce((s, r) => s + num(r.quantity), 0)
    const staleMin = Math.max(0, ...stale.map((r) => num(r.minThreshold)))

    await prisma.$transaction(async (tx) => {
      let dest = placeRows.find((r) => r.variantId === target.variantId)
      if (!dest) {
        dest = await tx.inventory.create({
          data: {
            organizationId,
            productId,
            variantId: target.variantId,
            locationId,
            locationType,
            quantity: 0,
            minThreshold: staleMin,
            unitId: targetUnit ?? stale[0].unitId ?? null,
          },
          select: { id: true, locationId: true, locationType: true, variantId: true, quantity: true, minThreshold: true, unitId: true },
        })
      }
      if (staleQty !== 0 || (num(dest.minThreshold) === 0 && staleMin > 0)) {
        await tx.inventory.update({
          where: { id: dest.id },
          data: {
            ...(staleQty !== 0 ? { quantity: { increment: staleQty } } : {}),
            ...(num(dest.minThreshold) === 0 && staleMin > 0 ? { minThreshold: staleMin } : {}),
            ...(targetUnit ? { unitId: targetUnit } : {}),
          },
        })
      }
      if (staleQty !== 0) {
        moved += staleQty
        await tx.inventoryMovement.createMany({
          data: [
            ...stale
              .filter((r) => num(r.quantity) !== 0)
              .map((r) => ({
                organizationId,
                productId,
                variantId: r.variantId,
                locationId,
                locationType,
                type: "adjustment" as const,
                quantity: -num(r.quantity),
                unitId: r.unitId,
                reason: "Cambio de tipo de producto (se une a la existencia vigente)",
              })),
            {
              organizationId,
              productId,
              variantId: target.variantId,
              locationId,
              locationType,
              type: "adjustment" as const,
              quantity: staleQty,
              unitId: targetUnit ?? stale[0].unitId ?? null,
              reason: "Cambio de tipo de producto (existencia unificada)",
            },
          ],
        })
      }
      await tx.inventory.deleteMany({ where: { id: { in: stale.map((r) => r.id) } } })
    })
  }
  return { moved }
}
