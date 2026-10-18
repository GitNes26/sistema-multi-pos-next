// Gastos del negocio: constantes puras compartidas por cliente y servidor.

export const EXPENSE_CATEGORIES = [
  { value: "merchandise", label: "Mercancía e insumos" },
  { value: "rent", label: "Renta" },
  { value: "utilities", label: "Luz, agua, gas e internet" },
  { value: "payroll", label: "Sueldos y comisiones" },
  { value: "maintenance", label: "Mantenimiento y reparaciones" },
  { value: "transport", label: "Transporte y fletes" },
  { value: "marketing", label: "Publicidad" },
  { value: "taxes", label: "Impuestos y permisos" },
  { value: "cash_withdrawal", label: "Retiro de caja" },
  { value: "other", label: "Otros" },
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]["value"]

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.value, c.label]))

export const EXPENSE_PAID_FROM = [
  { value: "other", label: "Fuera de la caja (transferencia, tarjeta o efectivo aparte)" },
  { value: "cash_register", label: "De la caja abierta (retiro de efectivo)" },
] as const

export const EXPENSE_PAID_FROM_LABELS: Record<string, string> = {
  other: "Fuera de la caja",
  cash_register: "De la caja",
}

export function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return typeof value === "string" && EXPENSE_CATEGORIES.some((c) => c.value === value)
}
