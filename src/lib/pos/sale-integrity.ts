import { round2 } from "./money"

type Line = { subtotal: number; taxRate: number }
type ItemTotals = { discount: number; lineTotal: number }

/** Reconciliación del ticket con importes calculados desde el catálogo en servidor. */
export function saleArithmeticError(input: {
  subtotal: number
  discount: number
  tax: number
  total: number
  discounts: { amount: number }[]
  items: ItemTotals[]
}, trustedLines: Line[]): string | null {
  if (trustedLines.length !== input.items.length ||
      ![input.subtotal, input.discount, input.tax, input.total].every(Number.isFinite) ||
      input.discounts.some((discount) => !Number.isFinite(discount.amount) || discount.amount < 0)) return "Totales o descuentos inválidos"

  const subtotal = round2(trustedLines.reduce((sum, line) => sum + line.subtotal, 0))
  if (Math.abs(input.subtotal - subtotal) > 0.01) return "Subtotal inválido"
  const discount = round2(Math.min(subtotal, input.discounts.reduce((sum, entry) => sum + entry.amount, 0)))
  if (Math.abs(input.discount - discount) > 0.01) return "El descuento no coincide con el detalle"

  let tax = 0
  for (let index = 0; index < trustedLines.length; index++) {
    const line = trustedLines[index]
    const allocated = subtotal > 0 ? round2((line.subtotal / subtotal) * discount) : 0
    const lineTotal = round2(line.subtotal - allocated)
    if (!Number.isFinite(input.items[index].discount) || !Number.isFinite(input.items[index].lineTotal) ||
        Math.abs(input.items[index].discount - allocated) > 0.01 ||
        Math.abs(input.items[index].lineTotal - lineTotal) > 0.01) return "El descuento por producto no coincide con el total"
    tax = round2(tax + round2(Math.max(0, lineTotal) * line.taxRate))
  }
  if (Math.abs(input.tax - tax) > 0.01 || Math.abs(input.total - round2(subtotal - discount + tax)) > 0.01) {
    return "El impuesto o total de la venta no coincide con el cálculo del servidor"
  }
  return null
}
