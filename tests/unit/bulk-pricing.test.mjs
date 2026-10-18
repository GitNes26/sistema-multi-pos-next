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

test("granel heredado sin unidad guardada cobra con el precio base", () => {
  const legacy = { bulkUnitId: null, bulkPricePerUnit: 32, allowSplit: false, splitUnitId: null, splitPricePerUnit: 0 }
  assert.equal(resolveBulkUnitPrice(legacy, ""), 32)
  assert.equal(resolveBulkUnitPrice(legacy, null), 32)
  assert.throws(() => resolveBulkUnitPrice(legacy, "kg"), /no está disponible/)
})

test("granel heredado sin precio base sigue rechazándose", () => {
  const legacy = { bulkUnitId: null, bulkPricePerUnit: 0, allowSplit: false, splitUnitId: null, splitPricePerUnit: 0 }
  assert.throws(() => resolveBulkUnitPrice(legacy, ""), /no está disponible/)
})
