import assert from "node:assert/strict"
import test from "node:test"
import { validateImportRecord } from "../../src/lib/excel/spreadsheet.ts"

test("clientes: acepta datos opcionales correctos y rechaza contacto inválido", () => {
  assert.deepEqual(validateImportRecord("customers", { fullName: "Ana", phone: "5512345678", email: "ana@ejemplo.mx", points: 0 }), [])
  const errors = validateImportRecord("customers", { fullName: "Ana", phone: "123", email: "correo roto", points: -2 })
  assert.equal(errors.length, 3)
})

test("categorías: rechaza una categoría padre que no existe", () => {
  assert.match(validateImportRecord("categories", { name: "Jugos", parentName: "__missing__:Bebidas" }).join(" "), /Bebidas/)
})

test("productos estándar: valida tipo, precio y categoría dependiente", () => {
  const errors = validateImportRecord("products", { name: "Martillo", productType: "__invalid_type__:otro", categoryName: "__missing__:Herramientas", price: Number.NaN, cost: 20 })
  assert.equal(errors.some((error) => error.includes("Estándar o Granel")), true)
  assert.equal(errors.some((error) => error.includes("Herramientas")), true)
  assert.equal(errors.some((error) => error.includes("price")), true)
})

test("productos a granel: exige unidad, incremento positivo y unidad alternativa", () => {
  const errors = validateImportRecord("products", { name: "Arroz", productType: "bulk", bulkPricePerUnit: 30, bulkMinQuantity: 0.1, bulkStep: 0, bulkMaxQuantity: 0, allowSplit: true, splitUnitName: null })
  assert.equal(errors.some((error) => error.includes("unidad del producto")), true)
  assert.equal(errors.some((error) => error.includes("incremento")), true)
  assert.equal(errors.some((error) => error.includes("alternativa")), true)
})
