import assert from "node:assert/strict"
import test from "node:test"
import { NAV_HREF_TO_FEATURE, isFeatureEnabled } from "../../src/lib/features.ts"

// Las rutas de los verticales deben tener bandera para que el menú del sidebar las oculte donde no aplican.
const GATED = ["/admin/warranties", "/admin/loyalty-programs", "/admin/stations", "/admin/assets", "/admin/service-orders", "/agenda", "/reservaciones"]

test("las rutas de los verticales tienen bandera de tipo de negocio", () => {
  for (const href of GATED) assert.ok(NAV_HREF_TO_FEATURE[href], `falta bandera para ${href}`)
})

test("tienda y restaurante no ven garantías, bahías, vehículos, órdenes ni agenda; sí ven fidelidad", () => {
  for (const mode of ["retail", "food_service"]) {
    for (const href of ["/admin/warranties", "/admin/stations", "/admin/assets", "/admin/service-orders", "/agenda", "/reservaciones"]) {
      assert.equal(isFeatureEnabled(NAV_HREF_TO_FEATURE[href], mode), false, `${href} en ${mode}`)
    }
    assert.equal(isFeatureEnabled(NAV_HREF_TO_FEATURE["/admin/loyalty-programs"], mode), true)
  }
})

test("renta solo ve reservaciones; servicios e híbrido ven los verticales de servicio", () => {
  assert.equal(isFeatureEnabled(NAV_HREF_TO_FEATURE["/reservaciones"], "rental"), true)
  for (const href of ["/admin/warranties", "/admin/stations", "/admin/loyalty-programs", "/agenda"]) assert.equal(isFeatureEnabled(NAV_HREF_TO_FEATURE[href], "rental"), false, `${href} en renta`)
  for (const mode of ["services", "hybrid"]) for (const href of ["/admin/warranties", "/admin/stations", "/admin/assets", "/admin/loyalty-programs", "/agenda"]) assert.equal(isFeatureEnabled(NAV_HREF_TO_FEATURE[href], mode), true, `${href} en ${mode}`)
})
