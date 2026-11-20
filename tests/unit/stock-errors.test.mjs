import test from "node:test"
import assert from "node:assert/strict"
import { StockShortageError, describeShortages, formatQuantity } from "../../src/lib/inventory/stock-errors.ts"

test("las cantidades se muestran sin ceros ni decimales de más", () => {
  assert.equal(formatQuantity(3), "3")
  assert.equal(formatQuantity(0.5), "0.5")
  assert.equal(formatQuantity(0.1250001), "0.125")
})

test("un producto que no alcanza dice cuánto se pide, cuánto hay y que no se cobró nada", () => {
  const msg = describeShortages([{ name: "Pastel de chocolate", needed: 3, available: 2, kind: "product" }], "pos")
  assert.match(msg, /No se puede cobrar por falta de inventario/)
  assert.match(msg, /«Pastel de chocolate» \(pides 3, solo hay 2\)/)
  assert.match(msg, /no se cobró nada/)
})

test("un producto agotado lo dice con palabras", () => {
  const msg = describeShortages([{ name: "Refresco", needed: 1, available: 0, kind: "product" }], "pos")
  assert.match(msg, /«Refresco» \(se agotó\)/)
})

test("sin registro de inventario se explica distinto a un faltante", () => {
  const msg = describeShortages([{ name: "Galleta", needed: 1, available: 0, kind: "product", noRecord: true }], "pos")
  assert.match(msg, /no tiene inventario registrado en esta sucursal/)
})

test("un insumo de receta nombra el insumo y lo que se iba a preparar", () => {
  const msg = describeShortages(
    [{ name: "Café molido", needed: 0.18, available: 0.1, kind: "ingredient", usedFor: ["Café americano"] }],
    "pos"
  )
  assert.match(msg, /Falta inventario de un insumo de la receta/)
  assert.match(msg, /«Café molido» para preparar «Café americano» \(se necesitan 0.18, solo hay 0.1\)/)
})

test("varios faltantes se avisan juntos", () => {
  const msg = describeShortages(
    [
      { name: "Pan", needed: 5, available: 1, kind: "product" },
      { name: "Queso", needed: 2, available: 0, kind: "product" },
    ],
    "pos"
  )
  assert.match(msg, /Estos productos no tienen suficiente inventario/)
  assert.match(msg, /«Pan».*«Queso»/)
})

test("en el portal el mensaje habla al cliente y no menciona caja", () => {
  const err = new StockShortageError([{ name: "Pastel", needed: 2, available: 1, kind: "product" }], "portal")
  assert.equal(err.status, 409)
  assert.equal(err.code, "insufficient_stock")
  assert.match(err.message, /ya no hay suficiente existencia/)
  assert.match(err.message, /carrito/)
  assert.doesNotMatch(err.message, /cobrar/)
})
