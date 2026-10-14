import test from "node:test"
import assert from "node:assert/strict"
import { matchesAllWords, matchesSearch, normalizeSearch } from "../../src/lib/search.ts"

test("búsqueda: ignora mayúsculas, acentos y espacios repetidos", () => {
  assert.equal(normalizeSearch("  JOSÉ   Peña "), "jose pena")
  assert.equal(matchesSearch("Café con leche", "CAFE"), true)
  assert.equal(matchesSearch("Piña colada", "pina"), true)
  assert.equal(matchesSearch("Jamón", ""), true)
  assert.equal(matchesSearch("Jamón", "queso"), false)
})

test("búsqueda por palabras: todas, en cualquier orden", () => {
  assert.equal(matchesAllWords("Hamburguesa doble con queso", "queso hamburguesa"), true)
  assert.equal(matchesAllWords("Hamburguesa doble", "queso hamburguesa"), false)
})
