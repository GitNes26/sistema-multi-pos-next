"use client";

import { useMemo } from "react";
import { usePosStore, selectCustomer } from "@/stores/pos-store";
import { computeTotals, pointsToMoney, type PricingLine } from "@/lib/pos/pricing";
import { getWeekdaysNumber } from "@/lib/pos/pricing-schedule";

export function usePosTotals() {
  const items = usePosStore((s) => s.items);
  const promotions = usePosStore((s) => s.promotions);
  const customerId = usePosStore((s) => s.customerId);
  const manualDiscount = usePosStore((s) => s.manualDiscount);
  const coupon = usePosStore((s) => s.coupon.result);
  const pointsRedeemed = usePosStore((s) => s.pointsRedeemed);

  return useMemo(() => {
    const customer = selectCustomer(customerId);
    const lines: PricingLine[] = items.map((i) => ({
      key: i.key,
      qty: i.qty,
      unitPrice: i.unitPrice,
      taxRate: i.taxRate,
      productId: i.productId,
      variantId: i.variantId,
      categoryId: i.categoryId,
    }));

    const totals = computeTotals({
      lines,
      promotions,
      customer,
      manualDiscount,
      coupon,
      pointsRedeemedValue: pointsToMoney(pointsRedeemed),
    });

    // 6.8 – Promoción "cupón para la próxima compra".
    const now = new Date();
    const nextPurchase = promotions.find(
      (p) =>
        p.benefit === "next_purchase_coupon" &&
        (p.scope === "order" || p.scope === "category" || p.scope === "product") &&
        (!p.requiresCustomer || !!customer) &&
        totals.subtotal >= p.minAmount &&
        (getWeekdaysNumber(p.weekdays).length === 0 || getWeekdaysNumber(p.weekdays).includes(now.getDay()))
    );

    return {
      ...totals,
      items,
      customer,
      pointsRedeemed,
      pointsAvailable: customer?.points ?? 0,
      nextPurchaseCoupon: nextPurchase
        ? { promotionId: nextPurchase.id, amount: nextPurchase.value || Math.round(totals.payable * 0.1) }
        : null,
    };
  }, [items, promotions, customerId, manualDiscount, coupon, pointsRedeemed]);
}