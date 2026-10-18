import assert from "node:assert/strict"
import test from "node:test"
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, EXPENSE_PAID_FROM_LABELS, isExpenseCategory } from "../../src/lib/expenses/shared.ts"

test("las categorías de gasto tienen etiqueta y son únicas", () => {
  const values = EXPENSE_CATEGORIES.map((c) => c.value)
  assert.equal(new Set(values).size, values.length)
  for (const value of values) assert.ok(EXPENSE_CATEGORY_LABELS[value])
  assert.ok(values.includes("cash_withdrawal"))
  assert.ok(values.includes("merchandise"))
})

test("solo se aceptan categorías conocidas", () => {
  assert.equal(isExpenseCategory("rent"), true)
  assert.equal(isExpenseCategory("otra-cosa"), false)
  assert.equal(isExpenseCategory(undefined), false)
})

test("el origen del dinero distingue caja y fuera de caja", () => {
  assert.equal(EXPENSE_PAID_FROM_LABELS.cash_register, "De la caja")
  assert.equal(EXPENSE_PAID_FROM_LABELS.other, "Fuera de la caja")
})
