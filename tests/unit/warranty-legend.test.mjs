import assert from "node:assert/strict"
import test from "node:test"
import { WARRANTY_PRESETS, warrantyLegendText } from "../../src/lib/warranty/presets.ts"
import { LOYALTY_PRESETS } from "../../src/lib/loyalty/presets.ts"

test("la leyenda del ticket se arma con las condiciones", () => {
  const text = warrantyLegendText({ name: "Lluvia", windowHours: 24, sameDayOnly: true, discountPercent: 100, legend: null })
  assert.match(text, /mismo día/)
  assert.match(text, /sin costo/)
})

test("con porcentaje y días la leyenda lo dice", () => {
  const text = warrantyLegendText({ name: "Reproceso", windowHours: 48, sameDayOnly: false, discountPercent: 50, legend: null })
  assert.match(text, /2 días/)
  assert.match(text, /50%/)
})

test("la leyenda propia del dueño manda", () => {
  assert.equal(warrantyLegendText({ name: "x", windowHours: 24, sameDayOnly: false, discountPercent: 100, legend: "  Texto propio  " }), "Texto propio")
})

test("las opciones de garantía son válidas", () => {
  for (const p of WARRANTY_PRESETS) {
    assert.ok(p.windowHours >= 1 && p.discountPercent >= 1 && p.discountPercent <= 100)
  }
})

test("las membresías precargadas traen periodo, aviso y condiciones", () => {
  const members = LOYALTY_PRESETS.filter((p) => p.kind === "membership")
  assert.ok(members.length >= 2)
  for (const m of members) {
    assert.ok((m.periodDays ?? 0) >= 1 && (m.packUses ?? 0) >= 1)
    assert.ok(m.terms && m.terms.length > 20)
  }
})
