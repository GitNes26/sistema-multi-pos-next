import assert from "node:assert/strict"
import test from "node:test"
import {
  parseRecipeVariantSelections,
  resolveRecipeIngredientVariant,
} from "../../src/lib/inventory/recipe-selection.ts"

test("identifica la variante de insumo elegida en el constructor", () => {
  const selections = parseRecipeVariantSelections([
    "regular-option",
    "recipevar:recipe-tinte:tinte-rojo",
  ])
  assert.equal(selections.get("recipe-tinte"), "tinte-rojo")
  assert.equal(
    resolveRecipeIngredientVariant(
      "recipe-tinte",
      ["tinte-negro", "tinte-rojo"],
      selections
    ),
    "tinte-rojo"
  )
})

test("usa automáticamente el único insumo disponible", () => {
  assert.equal(
    resolveRecipeIngredientVariant("recipe-tinte", ["tinte-negro"], new Map()),
    "tinte-negro"
  )
})

test("exige elección cuando el insumo tiene varias variantes", () => {
  assert.throws(
    () =>
      resolveRecipeIngredientVariant(
        "recipe-tinte",
        ["tinte-negro", "tinte-rojo"],
        new Map()
      ),
    /Selecciona la variante/
  )
})

test("rechaza una variante ajena o inactiva", () => {
  const selections = new Map([["recipe-tinte", "tinte-amarillo"]])
  assert.throws(
    () =>
      resolveRecipeIngredientVariant(
        "recipe-tinte",
        ["tinte-negro", "tinte-rojo"],
        selections
      ),
    /ya no está disponible/
  )
})
