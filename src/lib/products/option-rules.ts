export type OptionOverageMode = "value_price" | "fixed" | "blocked"

export interface OptionVariantRule {
  variantId: string
  included: number
  maxSelect: number
  overageMode: OptionOverageMode
  overagePrice: number
}

export function parseOptionVariantRules(value: unknown): OptionVariantRule[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return []
    const rule = raw as Record<string, unknown>
    if (typeof rule.variantId !== "string" || !rule.variantId) return []
    const included = Math.max(0, Math.floor(Number(rule.included) || 0))
    const mode: OptionOverageMode = ["value_price", "fixed", "blocked"].includes(String(rule.overageMode))
      ? rule.overageMode as OptionOverageMode
      : "value_price"
    const requestedMax = Math.max(0, Math.floor(Number(rule.maxSelect) || 0))
    return [{
      variantId: rule.variantId,
      included,
      maxSelect: mode === "blocked" ? included : Math.max(included, requestedMax),
      overageMode: mode,
      overagePrice: Math.max(0, Number(rule.overagePrice) || 0),
    }]
  })
}

export function optionRuleForVariant(value: unknown, variantId?: string | null) {
  if (!variantId) return null
  return parseOptionVariantRules(value).find((rule) => rule.variantId === variantId) ?? null
}

export function calculateOptionExtra(selectedPrices: number[], rule?: OptionVariantRule | null) {
  const prices = selectedPrices.map((price) => Math.max(0, Number(price) || 0))
  if (!rule) return prices.reduce((sum, price) => sum + price, 0)
  const excessCount = Math.max(0, prices.length - rule.included)
  if (!excessCount || rule.overageMode === "blocked") return 0
  if (rule.overageMode === "fixed") return excessCount * rule.overagePrice
  return prices.sort((a, b) => b - a).slice(0, excessCount).reduce((sum, price) => sum + price, 0)
}

export function calculateOptionValueCharges<T extends { id: string; extraPrice: number }>(
  selected: T[],
  rule?: OptionVariantRule | null
) {
  if (!rule) return new Map(selected.map((value) => [value.id, Math.max(0, value.extraPrice)]))
  const excessCount = Math.max(0, selected.length - rule.included)
  const charged = [...selected].sort((a, b) => b.extraPrice - a.extraPrice || a.id.localeCompare(b.id)).slice(0, excessCount)
  return new Map(selected.map((value) => [
    value.id,
    charged.some((item) => item.id === value.id)
      ? rule.overageMode === "fixed" ? rule.overagePrice : rule.overageMode === "value_price" ? Math.max(0, value.extraPrice) : 0
      : 0,
  ]))
}
