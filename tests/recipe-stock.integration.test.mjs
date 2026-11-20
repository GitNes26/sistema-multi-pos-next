import test from "node:test"
import assert from "node:assert/strict"
import { prisma } from "../src/lib/db/client.ts"
import { consumeRecipeIngredients, loadRecipeRows, recipeManagedItemKeys } from "../src/lib/inventory/recipes.ts"
import { sellableUnits } from "../src/lib/inventory/recipe-stock.ts"
import { StockShortageError } from "../src/lib/inventory/stock-errors.ts"

// Pastel que se vende entero y por rebanadas: el inventario se lleva en REBANADAS (números enteros).
// Entero = 8 rebanadas, rebanada = 1. Todo corre en una transacción que se revierte al final.
const ROLLBACK = new Error("rollback")

test("pastel entero y rebanadas descuentan enteros del mismo inventario y avisan con claridad cuando no alcanza", async () => {
  const organization = await prisma.organization.findFirst({ where: { name: "Supermercado Demo" } })
  assert.ok(organization, "La base demo debe contener Supermercado Demo")
  const location = await prisma.location.findFirst({ where: { organizationId: organization.id, isActive: true } })
  assert.ok(location)
  const organizationId = organization.id
  const locationId = location.id
  let verified = false
  await prisma
    .$transaction(async (tx) => {
      const base = await tx.product.create({ data: { organizationId, name: "Pastel TEST (rebanadas)", productType: "standard", trackInventory: true } })
      await tx.inventory.create({ data: { organizationId, productId: base.id, locationId, locationType: "location", quantity: 20 } })
      const whole = await tx.product.create({ data: { organizationId, name: "Pastel TEST entero", productType: "custom", trackInventory: false } })
      const slice = await tx.product.create({ data: { organizationId, name: "Pastel TEST rebanada", productType: "custom", trackInventory: false } })
      await tx.productRecipeItem.createMany({
        data: [
          { organizationId, productId: whole.id, ingredientProductId: base.id, quantity: 8 },
          { organizationId, productId: slice.id, ingredientProductId: base.id, quantity: 1 },
        ],
      })
      const stock = async () => Number((await tx.inventory.findFirst({ where: { productId: base.id, locationId } })).quantity)

      await consumeRecipeIngredients(tx, organizationId, locationId, "venta-1", null, [{ productId: whole.id, quantity: 1 }])
      assert.equal(await stock(), 12)
      await consumeRecipeIngredients(tx, organizationId, locationId, "venta-2", null, [{ productId: slice.id, quantity: 3 }])
      assert.equal(await stock(), 9)

      // 2 enteros necesitan 16 y solo hay 9: debe explicar qué falta, sin descontar nada.
      await assert.rejects(
        consumeRecipeIngredients(tx, organizationId, locationId, "venta-3", null, [{ productId: whole.id, quantity: 2 }]),
        (error) => {
          assert.ok(error instanceof StockShortageError)
          assert.equal(error.status, 409)
          assert.match(error.message, /«Pastel TEST \(rebanadas\)» para preparar «Pastel TEST entero» \(se necesitan 16, solo hay 9\)/)
          assert.match(error.message, /no se cobró nada/)
          return true
        }
      )
      assert.equal(await stock(), 9)
      verified = true
      throw ROLLBACK
    })
    .catch((error) => {
      if (error !== ROLLBACK) throw error
    })
  assert.equal(verified, true)
})

test("un solo producto «Pastel» con variantes Completo y Rebanada comparte una existencia con decimales", async () => {
  const organization = await prisma.organization.findFirst({ where: { name: "Supermercado Demo" } })
  const location = await prisma.location.findFirst({ where: { organizationId: organization.id, isActive: true } })
  const organizationId = organization.id
  const locationId = location.id
  let verified = false
  await prisma
    .$transaction(async (tx) => {
      const cake = await tx.product.create({ data: { organizationId, name: "Pastel de Nuez TEST", productType: "standard", trackInventory: true } })
      const full = await tx.productVariant.create({ data: { organizationId, productId: cake.id, name: "Completo", price: 300 } })
      const slice = await tx.productVariant.create({ data: { organizationId, productId: cake.id, name: "Rebanada", price: 35 } })
      await tx.inventory.create({ data: { organizationId, variantId: full.id, locationId, locationType: "location", quantity: 3 } })
      await tx.productRecipeItem.createMany({
        data: [
          { organizationId, productId: cake.id, variantId: full.id, ingredientVariantId: full.id, quantity: 1 },
          { organizationId, productId: cake.id, variantId: slice.id, ingredientVariantId: full.id, quantity: 0.1 },
        ],
      })
      const stock = async () => Number((await tx.inventory.findFirst({ where: { variantId: full.id, locationId } })).quantity)

      // El servidor reconoce que ninguna presentación se descuenta directamente: la receta manda.
      const managed = await recipeManagedItemKeys(tx, organizationId, [
        { productId: cake.id, variantId: full.id },
        { productId: cake.id, variantId: slice.id },
      ])
      assert.equal(managed.size, 2)

      // El catálogo ve piezas vendibles: 3 completos o 30 rebanadas.
      const rows = await loadRecipeRows(tx, organizationId, [cake.id])
      const stockOf = (id) => (id === full.id ? 3 : 0)
      assert.equal(sellableUnits(rows, cake.id, full.id, stockOf), 3)
      assert.equal(sellableUnits(rows, cake.id, slice.id, stockOf), 30)

      await consumeRecipeIngredients(tx, organizationId, locationId, "v-slices", null, [{ productId: cake.id, variantId: slice.id, quantity: 4 }])
      assert.equal(await stock(), 2.6)
      await consumeRecipeIngredients(tx, organizationId, locationId, "v-full", null, [{ productId: cake.id, variantId: full.id, quantity: 1 }])
      assert.equal(await stock(), 1.6)

      // 20 rebanadas necesitan 2 pasteles y quedan 1.6: se explica con decimales y no se descuenta nada.
      await assert.rejects(
        consumeRecipeIngredients(tx, organizationId, locationId, "v-too-many", null, [{ productId: cake.id, variantId: slice.id, quantity: 20 }]),
        (error) => {
          assert.ok(error instanceof StockShortageError)
          assert.match(error.message, /se necesitan 2, solo hay 1.6/)
          return true
        }
      )
      assert.equal(await stock(), 1.6)
      verified = true
      throw ROLLBACK
    })
    .catch((error) => {
      if (error !== ROLLBACK) throw error
    })
  assert.equal(verified, true)
})
