import assert from "node:assert/strict"
import test from "node:test"
import { redemptionAmount } from "../../src/lib/loyalty/redeem.ts"
import { computeTotals } from "../../src/lib/pos/pricing.ts"
import { LOYALTY_PRESETS } from "../../src/lib/loyalty/presets.ts"

const lines = [
  { productId: "corte", unitPrice: 120 },
  { productId: "barba", unitPrice: 80 },
  { productId: "refresco", unitPrice: 30 },
]

test("un crédito cubre la unidad elegible más barata", () => {
  assert.equal(redemptionAmount(lines, ["corte", "barba"], 100), 80)
})

test("el porcentaje configurado limita el premio", () => {
  assert.equal(redemptionAmount(lines, ["corte"], 50), 60)
})

test("sin productos marcados aplica a cualquiera salvo los excluidos (el paquete)", () => {
  assert.equal(redemptionAmount(lines, [], 100, ["refresco"]), 80)
  assert.equal(redemptionAmount([{ productId: "paquete", unitPrice: 270 }], [], 100, ["paquete"]), 0)
})

test("sin nada elegible el canje vale 0", () => {
  assert.equal(redemptionAmount(lines, ["otro"], 100), 0)
})

test("el POS suma la recompensa como descuento y baja el total", () => {
  const totals = computeTotals({
    lines: [{ key: "1", qty: 1, unitPrice: 100, taxRate: 0, productId: "corte", variantId: null, categoryId: null }],
    promotions: [], customer: null, manualDiscount: null, coupon: null, pointsRedeemedValue: 0,
    loyaltyRedeems: [{ programId: "p1", label: "Cada 5", targetProductIds: ["corte"], excludeProductIds: [], percent: 100 }],
  })
  assert.equal(totals.discountTotal, 100)
  assert.equal(totals.total, 0)
  assert.equal(totals.discounts[0].kind, "loyalty")
  assert.equal(totals.discounts[0].loyaltyProgramId, "p1")
})

test("las opciones precargadas son válidas", () => {
  assert.ok(LOYALTY_PRESETS.length >= 4)
  for (const p of LOYALTY_PRESETS) {
    assert.ok(p.discountPercent >= 1 && p.discountPercent <= 100)
    if (p.kind === "visit_card") assert.ok((p.visitsRequired ?? 0) >= 2)
    else assert.ok((p.packUses ?? 0) >= 1)
  }
})
