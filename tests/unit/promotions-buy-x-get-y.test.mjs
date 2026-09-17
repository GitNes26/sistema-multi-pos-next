import test from "node:test";
import assert from "node:assert/strict";
import { computeTotals } from "../../src/lib/pos/pricing.ts";
import { evaluatePortalPromotions } from "../../src/lib/portal/promo-engine.ts";

const promotion = { id: "promo", name: "2x1", benefit: "buy_x_get_y", scope: "product", value: 0, buyQuantity: 2, getQuantity: 1, minAmount: 0, minQuantity: 0, couponCode: null, requiresCustomer: false, priority: 1, exclusive: false, maxUses: null, usesCount: 0, startsAt: null, endsAt: null, weekdays: null, startTime: null, endTime: null, targets: [{ kind: "product", targetId: "p1" }] };
const lines = [{ key: "a", productId: "p1", variantId: "v1", categoryId: "c1", qty: 1, unitPrice: 20, taxRate: 0 }, { key: "b", productId: "p1", variantId: "v2", categoryId: "c1", qty: 1, unitPrice: 15, taxRate: 0 }];

test("POS aplica 2x1 entre variantes y descuenta la más barata", () => {
  const totals = computeTotals({ lines, promotions: [promotion], customer: null, manualDiscount: null, coupon: null, pointsRedeemedValue: 0 });
  assert.equal(totals.discountTotal, 15);
  assert.equal(totals.payable, 20);
});

test("portal aplica la misma regla 2x1", () => {
  const result = evaluatePortalPromotions([promotion], lines.map(line => ({ productId: line.productId, variantId: line.variantId, categoryId: line.categoryId, quantity: line.qty, unitPrice: line.unitPrice })));
  assert.equal(result.discount, 15);
});
