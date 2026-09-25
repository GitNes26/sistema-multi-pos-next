import test from "node:test"
import assert from "node:assert/strict"
import { buildTicketCode, parseTicketCode } from "../../src/lib/sales/ticket-code.ts"

test("el código de ticket conserva el identificador global de la venta", () => {
  const value = { saleId: "sale_03" }
  assert.deepEqual(parseTicketCode(buildTicketCode(value)), value)
})

test("rechaza texto, versiones y códigos incompletos", () => {
  assert.equal(parseTicketCode("12345"), null)
  assert.equal(parseTicketCode("MP2|sale"), null)
  assert.equal(parseTicketCode("MP1"), null)
  assert.equal(parseTicketCode("MP1|sale|extra"), null)
})
