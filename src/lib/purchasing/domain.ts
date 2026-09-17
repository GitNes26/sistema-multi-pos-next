export type PurchaseAmountItem = { quantity: number; unitCost: number; taxRate?: number };

export function purchaseTotals(items: PurchaseAmountItem[]) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  const tax = items.reduce((sum, item) => sum + item.quantity * item.unitCost * (item.taxRate ?? 0), 0);
  return { subtotal, tax, total: subtotal + tax };
}

export function canTransitionPurchaseOrder(current: string, next: string) {
  const transitions: Record<string, readonly string[]> = {
    draft: ["approved", "cancelled"],
    approved: ["sent", "cancelled"],
    sent: ["cancelled"],
    partially_received: ["cancelled"],
  };
  return transitions[current]?.includes(next) ?? false;
}

export function receivedOrderStatus(items: { quantity: number; receivedQuantity: number }[]) {
  return items.every(item => item.receivedQuantity >= item.quantity) ? "received" : "partially_received";
}
