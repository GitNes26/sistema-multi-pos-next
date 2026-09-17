import test from "node:test";
import assert from "node:assert/strict";
import { canTransitionPurchaseOrder, purchaseTotals, receivedOrderStatus } from "../../src/lib/purchasing/domain.ts";

test("calcula subtotal, impuestos y total de una compra", () => {
  assert.deepEqual(purchaseTotals([{ quantity: 2, unitCost: 100, taxRate: 0.16 }, { quantity: 3, unitCost: 10 }]), { subtotal: 230, tax: 32, total: 262 });
});

test("solo permite transiciones operativas válidas", () => {
  assert.equal(canTransitionPurchaseOrder("draft", "approved"), true);
  assert.equal(canTransitionPurchaseOrder("draft", "received"), false);
  assert.equal(canTransitionPurchaseOrder("received", "cancelled"), false);
});

test("distingue recepción parcial y completa", () => {
  assert.equal(receivedOrderStatus([{ quantity: 10, receivedQuantity: 6 }]), "partially_received");
  assert.equal(receivedOrderStatus([{ quantity: 10, receivedQuantity: 10 }, { quantity: 2, receivedQuantity: 2 }]), "received");
});
