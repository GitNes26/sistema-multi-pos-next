import assert from "node:assert/strict"
import test from "node:test"
import { friendlyServerError, supportCode } from "../../src/lib/errors/friendly.ts"

const safety = "Tu ticket sigue aquí."

test("el código de soporte tiene formato legible", () => {
  assert.match(supportCode(), /^E-[0-9A-F]{6}$/)
})

test("los errores de base de datos se explican sin tecnicismos y con el código", () => {
  const timeout = friendlyServerError({ code: "P2024" }, "guardar la venta", safety)
  assert.equal(timeout.status, 503)
  assert.match(timeout.message, /No pudimos guardar la venta/)
  assert.match(timeout.message, new RegExp(timeout.code))
  assert.match(timeout.message, /Tu ticket sigue aquí/)
  assert.equal(friendlyServerError({ code: "P2002" }, "guardar", safety).status, 409)
  assert.equal(friendlyServerError({ code: "P2003" }, "guardar", safety).status, 409)
  assert.equal(friendlyServerError({ code: "P2034" }, "guardar", safety).status, 409)
})

test("un error desconocido no filtra el detalle interno", () => {
  const out = friendlyServerError(new Error("SELECT * FROM secretos"), "guardar la venta", safety)
  assert.equal(out.status, 500)
  assert.doesNotMatch(out.message, /SELECT|secretos/)
  assert.match(out.message, /código de soporte/)
})
