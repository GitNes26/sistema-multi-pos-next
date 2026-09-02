import type { $Enums } from "@prisma/client";
import { usePosStore, selectCustomer } from "@/stores/pos-store";
import type { PosSalePayload } from "@/types/pos";
import type { usePosTotals } from "@/hooks/use-pos-totals";
import { round2 } from "./money";

export interface PaymentEntry {
  method: $Enums.PaymentMethod;
  amount: number;
  reference?: string;
}

/**
 * Construye el payload de venta a partir del snapshot del store y de los
 * totales calculados. Se calcula el descuento repartido por línea para el
 * ticket (6.12).
 */
export function buildSalePayload(
  totals: ReturnType<typeof usePosTotals>,
  entries: PaymentEntry[],
  changeGiven: number,
  tip: number = 0
): PosSalePayload {
  const state = usePosStore.getState();
  const customer = selectCustomer(state.customerId);
  const subtotal = totals.subtotal || 1;

  const items = totals.items.map((i) => {
    const lineSubtotal = round2(i.qty * i.unitPrice);
    const allocated = round2((lineSubtotal / subtotal) * totals.discountTotal);
    return {
      productId: i.productId,
      variantId: i.variantId,
      productType: (i.kind === "bulk" ? "bulk" : "standard") as $Enums.ProductType,
      productName: i.name,
      variantName: null,
      quantity: i.qty,
      unitId: i.unitId,
      unitPrice: i.unitPrice,
      totalPrice: lineSubtotal,
      discount: allocated,
      taxRate: i.taxRate,
      lineTotal: round2(lineSubtotal - allocated),
      bulkQuantityDisplay: i.bulkQuantityDisplay,
      trackInventory: i.trackInventory,
      notes: i.notes,
      selectedOptions: i.selectedOptions,
      extraPrice: i.extraPrice,
    };
  });

  return {
    items,
    customerId: customer?.id,
    subtotal: totals.subtotal,
    discount: totals.discountTotal,
    tax: totals.tax,
    total: totals.total,
    changeGiven: round2(changeGiven),
    pointsEarned: customer ? totals.pointsEarned : 0,
    pointsRedeemed: totals.pointsRedeemed,
    pointsRedeemedValue: totals.pointsRedeemedValue,
    payments: entries.map((e) => ({ method: e.method, amount: round2(e.amount), reference: e.reference })),
    discounts: totals.discounts.map((d) => ({
      label: d.label,
      amount: d.amount,
      promotionId: d.promotionId,
    })),
    cashSessionId: state.session?.id ?? undefined,
    cashRegisterId: state.registerId || undefined,
    couponCode: state.coupon.status === "applied" ? state.coupon.result?.code : undefined,
    nextPurchaseCoupon: totals.nextPurchaseCoupon ?? undefined,
    tableId: state.selectedTable?.id,
    tip: tip > 0 ? tip : undefined,
  };
}