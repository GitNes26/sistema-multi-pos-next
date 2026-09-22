import test from "node:test"
import assert from "node:assert/strict"
import { saleArithmeticError } from "../../src/lib/pos/sale-integrity.ts"

const lines = [{ subtotal: 100, taxRate: 0.16 }, { subtotal: 50, taxRate: 0.16 }]
const ticket = {
  subtotal: 150,
  discount: 30,
  tax: 19.2,
  total: 139.2,
  discounts: [{ amount: 30 }],
  items: [{ discount: 20, lineTotal: 80 }, { discount: 10, lineTotal: 40 }],
}

test("reconcilia descuentos, impuestos y total con los precios del catálogo", () => {
  assert.equal(saleArithmeticError(ticket, lines), null)
  assert.match(saleArithmeticError({ ...ticket, total: 1 }, lines), /total/)
  assert.match(saleArithmeticError({ ...ticket, tax: 0 }, lines), /impuesto/)
  assert.match(saleArithmeticError({ ...ticket, discount: 100 }, lines), /descuento/)
  assert.match(saleArithmeticError({ ...ticket, items: [{ discount: 100, lineTotal: 0 }, ticket.items[1]] }, lines), /producto/)
})
