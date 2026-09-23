import assert from "node:assert/strict"
import test from "node:test"
import {
  calculateOptionExtra,
  calculateOptionValueCharges,
  optionRuleForVariant,
  parseOptionVariantRules,
} from "../../src/lib/products/option-rules.ts"

test("aplica cupos diferentes de sabores según el tamaño", () => {
  const rules = parseOptionVariantRules([
    { variantId: "ch", included: 1, maxSelect: 1, overageMode: "blocked", overagePrice: 0 },
    { variantId: "md", included: 2, maxSelect: 3, overageMode: "fixed", overagePrice: 12 },
    { variantId: "gr", included: 3, maxSelect: 4, overageMode: "value_price", overagePrice: 0 },
  ])
  assert.equal(optionRuleForVariant(rules, "ch")?.maxSelect, 1)
  assert.equal(optionRuleForVariant(rules, "md")?.included, 2)
  assert.equal(calculateOptionExtra([0, 0, 0], optionRuleForVariant(rules, "md")), 12)
})

test("cobra los toppings premium que exceden el cupo gratuito", () => {
  const rule = { variantId: "gr", included: 2, maxSelect: 4, overageMode: "value_price", overagePrice: 0 }
  assert.equal(calculateOptionExtra([0, 8, 20, 12], rule), 32)
  const charges = calculateOptionValueCharges([
    { id: "chispas", extraPrice: 0 },
    { id: "lunetas", extraPrice: 8 },
    { id: "ferrero", extraPrice: 20 },
    { id: "chocolate", extraPrice: 12 },
  ], rule)
  assert.equal(charges.get("ferrero"), 20)
  assert.equal(charges.get("chocolate"), 12)
  assert.equal(charges.get("lunetas"), 0)
})

test("bloqueado iguala el máximo al cupo incluido", () => {
  const [rule] = parseOptionVariantRules([
    { variantId: "ch", included: 1, maxSelect: 99, overageMode: "blocked", overagePrice: 0 },
  ])
  assert.equal(rule.maxSelect, 1)
  assert.equal(calculateOptionExtra([15], rule), 0)
})
