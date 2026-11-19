import test from "node:test"
import assert from "node:assert/strict"
import { daysUntil, demoLabel, demoPeriodEnd, demoPhase, monthlyCost, PERMANENT_DEMO_DAYS } from "../../src/lib/billing/demo.ts"
import { buildTicketCode, parseTicketCode } from "../../src/lib/sales/ticket-code.ts"

const now = new Date("2026-11-19T10:00:00")

test("la prueba termina al final del día N contado desde hoy", () => {
  const end = demoPeriodEnd(14, now)
  assert.equal(end.getDate(), 3) // 19 nov + 14 días = 3 dic
  assert.equal(end.getMonth(), 11)
  assert.equal(end.getHours(), 23)
  assert.equal(daysUntil(end, now), 14)
})

test("los días de prueba se acotan a un rango válido", () => {
  assert.equal(daysUntil(demoPeriodEnd(0, now), now) >= 1, true)
  assert.equal(daysUntil(demoPeriodEnd(99999, now), now) <= PERMANENT_DEMO_DAYS + 1, true)
})

test("la leyenda para la empresa dice cuántos días le quedan", () => {
  assert.equal(demoLabel(demoPeriodEnd(9, now), now), "Te quedan 9 días de prueba gratis")
  assert.equal(demoLabel(demoPeriodEnd(1, now), now), "Te queda 1 día de prueba gratis")
  assert.equal(demoLabel(new Date("2026-11-19T20:00:00"), now), "Tu prueba gratis termina hoy")
  assert.equal(demoLabel(new Date("2026-11-10T20:00:00"), now), "Tu prueba gratis terminó")
  assert.match(demoLabel(new Date("2099-12-31T23:59:59"), now), /sin costo/)
})

test("la fase distingue en curso, últimos días, terminada y permanente", () => {
  assert.equal(demoPhase(demoPeriodEnd(20, now), now), "running")
  assert.equal(demoPhase(demoPeriodEnd(2, now), now), "last_days")
  assert.equal(demoPhase(new Date("2026-11-01T00:00:00"), now), "ended")
  assert.equal(demoPhase(new Date("2099-12-31T00:00:00"), now), "permanent")
})

test("lo que costaría suma plan base y capacidad extra aunque no se cobre", () => {
  const plan = { monthlyPrice: "499.00", extraLocationPrice: "150", extraEmployeePackPrice: 80 }
  assert.equal(monthlyCost(plan, 0, 0), 499)
  assert.equal(monthlyCost(plan, 2, 3), 499 + 300 + 240)
})

test("el código de barras del ticket del portal es el mismo que imprime el POS", () => {
  const code = buildTicketCode({ saleId: "cmabc123XYZ" })
  assert.equal(code, "MP1|cmabc123XYZ")
  assert.deepEqual(parseTicketCode(code), { saleId: "cmabc123XYZ" })
})
