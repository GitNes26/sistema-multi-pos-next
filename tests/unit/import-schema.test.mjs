import assert from "node:assert/strict"
import test from "node:test"
import {
  duplicateValues,
  parseBoolean,
  parseOptionalNumber,
  validateEmail,
  validatePhone,
} from "../../src/lib/excel/import-schema.ts"

test("normaliza booleanos usados por las plantillas", () => {
  assert.equal(parseBoolean("Sí"), true)
  assert.equal(parseBoolean("INACTIVA"), false)
  assert.equal(parseBoolean("quizá"), undefined)
})

test("distingue números vacíos de números inválidos", () => {
  assert.equal(parseOptionalNumber(""), null)
  assert.equal(parseOptionalNumber("12.5"), 12.5)
  assert.equal(Number.isNaN(parseOptionalNumber("doce")), true)
})

test("valida correo y teléfono opcionales", () => {
  assert.equal(validateEmail(""), true)
  assert.equal(validateEmail("cliente@ejemplo.mx"), true)
  assert.equal(validateEmail("correo roto"), false)
  assert.equal(validatePhone("5512345678"), true)
  assert.equal(validatePhone("123"), false)
})

test("detecta duplicados ignorando mayúsculas y espacios", () => {
  assert.deepEqual([...duplicateValues(["Bebidas", " bebidas ", "Comida"])], ["bebidas"])
})
