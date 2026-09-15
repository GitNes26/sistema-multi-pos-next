import test from "node:test";
import assert from "node:assert/strict";

import { evaluatePortalPromotions } from "../../src/lib/portal/promo-engine.ts";

test("portal: una promoción para cliente identificado aplica en checkout", () => {
  const result = evaluatePortalPromotions(
    [{
      id: "promo-customer",
      name: "Cliente frecuente",
      benefit: "percent_off",
      scope: "order",
      value: 10,
      buyQuantity: 0,
      getQuantity: 0,
      minAmount: 0,
      minQuantity: 0,
      couponCode: null,
      requiresCustomer: true,
      priority: 1,
      exclusive: false,
      maxUses: null,
      usesCount: 0,
      startsAt: null,
      endsAt: null,
      weekdays: null,
      startTime: null,
      endTime: null,
      targets: [],
    }],
    [{
      productId: "product-1",
      variantId: "variant-1",
      productType: "standard",
      productName: "Producto",
      variantName: null,
      quantity: 2,
      unitId: null,
      unitPrice: 50,
      lineTotal: 100,
      categoryId: null,
    }],
  );

  assert.equal(result.discount, 10);
  assert.equal(result.promotionId, "promo-customer");
});
