import test from "node:test"
import assert from "node:assert/strict"
import { prisma } from "../src/lib/db/client.ts"
import { inventorySnapshot } from "../src/lib/inventory/server.ts"
import { getLowStockAlerts } from "../src/lib/reports/bi-server.ts"
import { getReorderSuggestions } from "../src/lib/inventory/reorder.ts"

// Pastel con variantes Completo / Rebanada ligadas por receta: inventario muestra UN solo registro (el entero).
test("el inventario no repite la presentacion derivada de otra por receta", async () => {
  const org = await prisma.organization.findFirst({ where: { name: "Supermercado Demo" } })
  const location = await prisma.location.findFirst({ where: { organizationId: org.id, isActive: true } })
  const organizationId = org.id
  const locationId = location.id
  const product = await prisma.product.create({ data: { organizationId, name: "Pastel TEST derivado", productType: "standard", trackInventory: true } })
  try {
    const whole = await prisma.productVariant.create({ data: { organizationId, productId: product.id, name: "Completo", price: 300 } })
    const slice = await prisma.productVariant.create({ data: { organizationId, productId: product.id, name: "Rebanada", price: 40 } })
    await prisma.inventory.createMany({ data: [{ organizationId, productId: product.id, variantId: whole.id, locationId, locationType: "location", quantity: 3 }, { organizationId, productId: product.id, variantId: slice.id, locationId, locationType: "location", quantity: 0 }] })
    const names = async () => (await inventorySnapshot(organizationId, { locationType: "location", locationId, q: "Pastel TEST derivado" })).map((r) => r.variantName).sort()
    await prisma.inventory.updateMany({ where: { productId: product.id }, data: { minThreshold: 1 } })
    const lowNames = async () => (await getLowStockAlerts(organizationId, locationId)).rows.filter((r) => r.productName.startsWith("Pastel TEST derivado")).map((r) => r.productName)
    const reorder = async () => (await getReorderSuggestions(organizationId, "location", locationId)).flatMap((g) => g.items ?? []).filter((i) => String(i.productName ?? i.name ?? "").startsWith("Pastel TEST derivado")).length
    // Sin receta: dos registros (la rebanada en 0 aparece como alerta).
    assert.deepEqual(await names(), ["Completo", "Rebanada"])
    assert.deepEqual(await lowNames(), ["Pastel TEST derivado · Rebanada"])
    // Rebanada se vende de 0.1 del entero (el entero no necesita receta propia).
    await prisma.productRecipeItem.create({ data: { organizationId, productId: product.id, variantId: slice.id, ingredientProductId: product.id, ingredientVariantId: whole.id, quantity: 0.1 } })
    assert.deepEqual(await names(), ["Completo"])
    // Reportes y reorden tampoco la cuentan: el entero (3 > mínimo 1) no está bajo.
    assert.deepEqual(await lowNames(), [])
    assert.equal(await reorder(), 0)
    // Si la rebanada tuviera existencia propia, no se esconde.
    await prisma.inventory.updateMany({ where: { variantId: slice.id }, data: { quantity: 2 } })
    assert.deepEqual(await names(), ["Completo", "Rebanada"])
  } finally {
    await prisma.productRecipeItem.deleteMany({ where: { productId: product.id } })
    await prisma.inventory.deleteMany({ where: { productId: product.id } })
    await prisma.inventoryMovement.deleteMany({ where: { productId: product.id } })
    await prisma.productVariant.deleteMany({ where: { productId: product.id } })
    await prisma.product.delete({ where: { id: product.id } })
    await prisma.$disconnect()
  }
})
