import test from "node:test"
import assert from "node:assert/strict"
import { customerMayUsePromotion } from "../../src/lib/promotions/customer-use.ts"

test("el límite por cliente excluye al cliente agotado y exige identificarlo", () => {
  assert.equal(customerMayUsePromotion(null, null, 100), true)
  assert.equal(customerMayUsePromotion(2, null, 0), false)
  assert.equal(customerMayUsePromotion(2, "cliente-1", 1), true)
  assert.equal(customerMayUsePromotion(2, "cliente-1", 2), false)
})
