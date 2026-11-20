import test from "node:test"
import assert from "node:assert/strict"
import { wrapByWidth } from "../../src/lib/pos/ticket-text.ts"

// Medida de pruebas: cada letra mide 1 (tipografía monoespaciada).
const m = (s) => s.length

test("lo que cabe se queda en un renglón", () => {
  assert.deepEqual(wrapByWidth("Promo 2x1", 20, m), ["Promo 2x1"])
})

test("una promoción larga baja de renglón por palabras sin cortar palabras", () => {
  const lines = wrapByWidth("Promoción de temporada 2x1 en pasteles", 16, m)
  assert.deepEqual(lines, ["Promoción de", "temporada 2x1 en", "pasteles"])
  assert.ok(lines.every((l) => l.length <= 16))
})

test("una palabra más larga que el renglón se parte por letras", () => {
  assert.deepEqual(wrapByWidth("SuperPromocionExtraLarga", 10, m, { maxLines: 5 }), ["SuperPromo", "cionExtraL", "arga"])
})

test("pasado el máximo de renglones termina con puntos suspensivos", () => {
  const lines = wrapByWidth("uno dos tres cuatro cinco seis siete ocho", 9, m, { maxLines: 2 })
  assert.equal(lines.length, 2)
  assert.ok(lines[1].endsWith("…"))
  assert.ok(lines.every((l) => l.length <= 9))
})

test("espacios repetidos y texto vacío no rompen nada", () => {
  assert.deepEqual(wrapByWidth("  a   b  ", 10, m), ["a b"])
  assert.deepEqual(wrapByWidth("   ", 10, m), [""])
})
