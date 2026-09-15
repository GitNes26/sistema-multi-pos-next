import assert from "node:assert/strict"
import test from "node:test"
import { resolveBulkUnitPrice } from "../../src/lib/pos/bulk-pricing.ts"

const product = {
  bulkUnitId: "kg",
  bulkPricePerUnit: 120,
  allowSplit: true,
  splitUnitId: "piece",
  splitPricePerUnit: 18,
}

test("usa el precio de la unidad principal a granel", () => {
  assert.equal(resolveBulkUnitPrice(product, "kg"), 120)
})

test("usa el precio de la presentación dividida", () => {
  assert.equal(resolveBulkUnitPrice(product, "piece"), 18)
})

test("rechaza unidades ajenas al producto", () => {
  assert.throws(() => resolveBulkUnitPrice(product, "liter"), /no está disponible/)
})
