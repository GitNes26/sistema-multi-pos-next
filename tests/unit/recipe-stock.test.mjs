import test from "node:test"
import assert from "node:assert/strict"
import { recipeManagedVariants, sellableUnits } from "../../src/lib/inventory/recipe-stock.ts"

const row = (o) => ({ productId: "p", variantId: null, optionValueId: null, ingredientProductId: null, ingredientVariantId: null, quantity: 1, wastePercent: 0, ...o })

// Pastel de Nuez: «Completo» gasta 1 y «Rebanada» gasta 0.1 del mismo pastel (existencias en la variante Completo).
const own = [row({ variantId: "full", ingredientVariantId: "full", quantity: 1 }), row({ variantId: "slice", ingredientVariantId: "full", quantity: 0.1 })]
const stock = (id) => ({ full: 3 })[id] ?? 0

test("con 3 pasteles se pueden vender 3 completos o 30 rebanadas", () => {
  assert.equal(sellableUnits(own, "p", "full", stock), 3)
  assert.equal(sellableUnits(own, "p", "slice", stock), 30)
})

test("0.1 no pierde piezas por decimales binarios", () => {
  assert.equal(sellableUnits(own, "p", "slice", () => 0.3), 3)
  assert.equal(sellableUnits(own, "p", "slice", () => 0.7), 7)
})

test("sin existencias no se puede vender y sin receta no se deriva", () => {
  assert.equal(sellableUnits(own, "p", "slice", () => 0), 0)
  assert.equal(sellableUnits([], "p", "slice", stock), null)
})

test("la merma sube lo que se gasta por pieza", () => {
  const rows = [row({ variantId: "slice", ingredientVariantId: "full", quantity: 0.1, wastePercent: 10 })]
  assert.equal(sellableUnits(rows, "p", "slice", () => 1.1), 10)
})

test("varios insumos: manda el que más limita", () => {
  const rows = [row({ ingredientVariantId: "masa", quantity: 2 }), row({ ingredientVariantId: "nuez", quantity: 0.5 })]
  assert.equal(sellableUnits(rows, "p", "v", (id) => ({ masa: 10, nuez: 1 })[id]), 2)
})

test("opción 1: producto con control de inventario cuyas variantes se descuentan de sí mismo queda gestionado", () => {
  const managed = recipeManagedVariants(own, { id: "p", trackInventory: true, variantIds: ["full", "slice"] })
  assert.deepEqual([...managed].sort(), ["full", "slice"])
})

test("opción 2: producto sin control de inventario ligado a otro producto queda gestionado", () => {
  const rows = [row({ productId: "rebanada", ingredientVariantId: "pastelVariant", quantity: 0.1 })]
  const managed = recipeManagedVariants(rows, { id: "rebanada", trackInventory: false, variantIds: ["r1"] })
  assert.deepEqual([...managed], ["r1"])
})

test("un producto con inventario propio y una receta de insumos ajenos conserva su comportamiento", () => {
  const rows = [row({ ingredientVariantId: "harina", quantity: 0.2 })]
  assert.equal(recipeManagedVariants(rows, { id: "p", trackInventory: true, variantIds: ["a"] }).size, 0)
})

test("si una presentación no tiene receta, ninguna se deriva", () => {
  const rows = [row({ variantId: "slice", ingredientVariantId: "full", quantity: 0.1 })]
  assert.equal(recipeManagedVariants(rows, { id: "p", trackInventory: false, variantIds: ["full", "slice"] }).size, 0)
})

test("los insumos a elegir al vender (producto completo) no se pueden calcular", () => {
  const rows = [row({ ingredientProductId: "x", quantity: 1 })]
  assert.equal(sellableUnits(rows, "p", "v", () => 5), null)
})
