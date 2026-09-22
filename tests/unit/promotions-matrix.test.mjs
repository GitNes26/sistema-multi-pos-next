import test from "node:test";
import assert from "node:assert/strict";
import { computeTotals } from "../../src/lib/pos/pricing.ts";
import { evaluatePortalPromotions } from "../../src/lib/portal/promo-engine.ts";
import { generateDescriptionFinal } from "../../src/lib/promotions/description.ts";

const lines = [
  { key: "a", productId: "p1", variantId: "v1", categoryId: "c1", qty: 2, unitPrice: 20, taxRate: 0 },
  { key: "b", productId: "p2", variantId: "v2", categoryId: "c2", qty: 1, unitPrice: 10, taxRate: 0 },
];
const base = {
  id: "promo", name: "Prueba", benefit: "percent_off", scope: "order", value: 10,
  buyQuantity: 2, getQuantity: 1, minAmount: 0, minQuantity: 0,
  couponCode: null, requiresCustomer: false, priority: 1, exclusive: false,
  maxUses: null, usesCount: 0, startsAt: null, endsAt: null,
  weekdays: null, startTime: null, endTime: null,
  targets: [{ kind: "category", targetId: "c1" }, { kind: "product", targetId: "p1" }, { kind: "variant", targetId: "v1" }],
};
const portalLines = lines.map(({ productId, variantId, categoryId, qty, unitPrice }) => ({ productId, variantId, categoryId, quantity: qty, unitPrice }));
const posDiscount = (promotion) => computeTotals({ lines, promotions: [promotion], customer: null, manualDiscount: null, coupon: null, pointsRedeemedValue: 0 }).discountTotal;
const portalDiscount = (promotion) => evaluatePortalPromotions([promotion], portalLines).discount;

for (const [benefit, value, expected] of [
  ["percent_off", 10, { order: 5, category: 4, product: 4, variant: 4 }],
  ["amount_off", 7, { order: 7, category: 7, product: 7, variant: 7 }],
  ["fixed_price", 8, { order: 26, category: 24, product: 24, variant: 24 }],
  ["buy_x_get_y", 0, { order: 10, category: 20, product: 20, variant: 20 }],
  ["free_item", 0, { order: 10, category: 20, product: 20, variant: 20 }],
  ["next_purchase_coupon", 10, { order: 0, category: 0, product: 0, variant: 0 }],
]) {
  for (const scope of ["order", "category", "product", "variant"]) {
    test(`${benefit} / ${scope}: POS y portal coinciden`, () => {
      const promotion = { ...base, benefit, scope, value };
      assert.equal(posDiscount(promotion), expected[scope]);
      assert.equal(portalDiscount(promotion), expected[scope]);
    });
  }
}

test("2x1 respeta paquetes completos y límites de elegibilidad", () => {
  assert.equal(posDiscount({ ...base, benefit: "buy_x_get_y", scope: "order", buyQuantity: 4 }), 0);
  assert.equal(posDiscount({ ...base, benefit: "buy_x_get_y", scope: "order", minAmount: 51 }), 0);
  assert.equal(posDiscount({ ...base, benefit: "buy_x_get_y", scope: "order", minQuantity: 4 }), 0);
  assert.equal(posDiscount({ ...base, benefit: "buy_x_get_y", scope: "order", maxUses: 1, usesCount: 1 }), 0);
  assert.equal(posDiscount({ ...base, benefit: "buy_x_get_y", scope: "order", couponCode: "SOLOCONCODIGO" }), 0);
  assert.equal(posDiscount({ ...base, benefit: "buy_x_get_y", scope: "order", requiresCustomer: true }), 0);
});

test("la descripción no inventa un porcentaje de cupón", () => {
  assert.match(generateDescriptionFinal({ benefit: "next_purchase_coupon", value: 10 }), /\$10/);
  assert.doesNotMatch(generateDescriptionFinal({ benefit: "next_purchase_coupon", value: 0 }), /\$10%/);
});
