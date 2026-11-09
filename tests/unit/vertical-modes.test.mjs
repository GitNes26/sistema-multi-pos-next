import assert from "node:assert/strict"
import test from "node:test"
import { CONTAINER_MODES, LOYALTY_KIND_MODES, LOYALTY_MODES, SERVICE_STATION_MODES, WARRANTY_MODES, loyaltyKindsFor, notForModeMessage } from "../../src/lib/vertical-modes.ts"
import { isFeatureEnabled } from "../../src/lib/features.ts"

const MODES = ["retail", "food_service", "services", "rental", "hybrid"]

test("la tarjeta de visitas aplica a todos menos renta; paquetes y membresías solo a servicios e híbrido", () => {
  assert.deepEqual(loyaltyKindsFor("retail"), ["visit_card"])
  assert.deepEqual(loyaltyKindsFor("food_service"), ["visit_card"])
  assert.deepEqual(loyaltyKindsFor("services"), ["visit_card", "prepaid_pack", "membership"])
  assert.deepEqual(loyaltyKindsFor("hybrid"), ["visit_card", "prepaid_pack", "membership"])
  assert.deepEqual(loyaltyKindsFor("rental"), [])
})

test("las garantías de servicio son solo de servicios e híbrido", () => {
  assert.deepEqual([...WARRANTY_MODES], ["services", "hybrid"])
})

test("los envases retornables son de tienda, restaurante/café e híbrido", () => {
  assert.deepEqual([...CONTAINER_MODES], ["retail", "food_service", "hybrid"])
})

test("las banderas del menú coinciden con la matriz", () => {
  for (const mode of MODES) {
    assert.equal(isFeatureEnabled("loyalty_programs", mode), LOYALTY_MODES.includes(mode), `fidelidad en ${mode}`)
    assert.equal(isFeatureEnabled("warranties", mode), WARRANTY_MODES.includes(mode), `garantías en ${mode}`)
    assert.equal(isFeatureEnabled("returnable_containers", mode), CONTAINER_MODES.includes(mode), `envases en ${mode}`)
    assert.equal(isFeatureEnabled("stations", mode), SERVICE_STATION_MODES.includes(mode), `bahías en ${mode}`)
  }
})

test("el menú de fidelidad cubre cualquier tipo donde exista algún programa", () => {
  const withAny = MODES.filter((m) => loyaltyKindsFor(m).length > 0)
  assert.deepEqual(withAny, [...LOYALTY_MODES])
  for (const kind of Object.keys(LOYALTY_KIND_MODES)) assert.ok(LOYALTY_KIND_MODES[kind].every((m) => LOYALTY_MODES.includes(m)))
})

test("el mensaje de «no aplica» nombra el tipo de negocio y dónde sí está", () => {
  const text = notForModeMessage("Las garantías de servicio", "retail", WARRANTY_MODES)
  assert.match(text, /Tienda/)
  assert.match(text, /Servicios/)
  assert.match(text, /Híbrido/)
})
