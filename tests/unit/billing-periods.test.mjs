import test from "node:test"
import assert from "node:assert/strict"
import { addMonthsYmd, billingLabel, parseBillingMonths, resolveBillingDate } from "../../src/lib/billing/periods.ts"
import { parseMonthText } from "../../src/lib/month-input.ts"

test("el vencimiento suma meses sin salirse del mes destino", () => {
  assert.equal(addMonthsYmd("2026-11-26", 1), "2026-12-26")
  assert.equal(addMonthsYmd("2026-11-26", 3), "2027-02-26")
  assert.equal(addMonthsYmd("2026-01-31", 1), "2026-02-28")
  assert.equal(addMonthsYmd("2028-01-31", 1), "2028-02-29")
  assert.equal(addMonthsYmd("2028-02-29", 12), "2029-02-28")
  assert.equal(addMonthsYmd("", 1), "")
})

test("guardar sin cambiar el día conserva la fecha real intacta", () => {
  const saved = new Date("2026-12-05T02:13:44.000Z")
  assert.equal(resolveBillingDate("2026-12-05", saved), saved)
  assert.equal(resolveBillingDate("2026-12-06", saved).toISOString(), "2026-12-06T12:00:00.000Z")
  assert.equal(resolveBillingDate("2026-12-06", saved, "end").toISOString(), "2026-12-06T23:59:59.000Z")
  assert.equal(resolveBillingDate("2026-02-31"), null)
  assert.equal(resolveBillingDate(""), null)
})

test("frecuencia de pago: vacía es fecha manual y solo admite 1 a 120 meses", () => {
  assert.equal(parseBillingMonths(null), null)
  assert.equal(parseBillingMonths(""), null)
  assert.equal(parseBillingMonths("6"), 6)
  for (const bad of [0, -1, 1.5, 121, "abc"]) assert.throws(() => parseBillingMonths(bad))
  assert.equal(billingLabel(1), "Cada mes")
  assert.equal(billingLabel(3), "Cada 3 meses")
  assert.equal(billingLabel(12), "Cada año")
  assert.equal(billingLabel(null), "Fecha manual")
})

test("el mes se puede escribir por número o por nombre", () => {
  assert.equal(parseMonthText("8"), 7)
  assert.equal(parseMonthText("ago"), 7)
  assert.equal(parseMonthText("Septiembre"), 8)
  assert.equal(parseMonthText("mar"), 2)
  assert.equal(parseMonthText("may"), 4)
  assert.equal(parseMonthText("ma"), null)
  assert.equal(parseMonthText("13"), null)
  assert.equal(parseMonthText(""), null)
})
