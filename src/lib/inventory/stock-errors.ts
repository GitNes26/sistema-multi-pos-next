// Faltantes de inventario explicados a quien cobra o compra: qué producto o insumo no alcanza,
// cuánto se pide y cuánto hay, y qué hacer. Módulo puro (sin base de datos) para poder probarlo.

export interface StockShortage {
  /** Nombre del producto (o variante) o del insumo que no alcanza. */
  name: string
  needed: number
  available: number
  /** `product` = lo que se vende; `ingredient` = insumo de la receta de lo que se vende. */
  kind: "product" | "ingredient"
  /** No existe registro de inventario en la sucursal. */
  noRecord?: boolean
  /** Para insumos: productos vendidos que lo necesitan. */
  usedFor?: string[]
}

export class StockShortageError extends Error {
  status = 409
  code = "insufficient_stock" as const
  shortages: StockShortage[]
  constructor(shortages: StockShortage[], context: StockContext = "pos") {
    super(describeShortages(shortages, context))
    this.name = "StockShortageError"
    this.shortages = shortages
  }
}

export type StockContext = "pos" | "portal"

/** 0.5 → «0.5», 3 → «3», 0.1250001 → «0.125». */
export function formatQuantity(value: number): string {
  return Number(value.toFixed(3)).toLocaleString("es-MX", { maximumFractionDigits: 3 })
}

function line(s: StockShortage): string {
  const name = `«${s.name}»`
  if (s.noRecord) return `${name} (no tiene inventario registrado en esta sucursal)`
  const detail = s.available <= 0 ? "se agotó" : `${s.kind === "ingredient" ? "se necesitan" : "pides"} ${formatQuantity(s.needed)}, solo hay ${formatQuantity(s.available)}`
  const forWhat = s.kind === "ingredient" && s.usedFor?.length ? ` para preparar ${s.usedFor.map((n) => `«${n}»`).join(", ")}` : ""
  return `${name}${forWhat} (${s.kind === "ingredient" && s.available <= 0 ? "insumo agotado" : detail})`
}

/** Mensaje completo y accionable para mostrar tal cual. */
export function describeShortages(shortages: StockShortage[], context: StockContext = "pos"): string {
  const products = shortages.filter((s) => s.kind === "product")
  const ingredients = shortages.filter((s) => s.kind === "ingredient")
  const parts: string[] = []
  if (products.length) {
    parts.push(
      `${products.length === 1 ? "Este producto no tiene" : "Estos productos no tienen"} suficiente inventario: ${products.map(line).join("; ")}.`
    )
  }
  if (ingredients.length) {
    parts.push(`Falta inventario de ${ingredients.length === 1 ? "un insumo" : "insumos"} de la receta: ${ingredients.map(line).join("; ")}.`)
  }
  const head = context === "pos" ? "No se puede cobrar por falta de inventario. " : "No pudimos tomar tu pedido porque ya no hay suficiente existencia. "
  const tail =
    context === "pos"
      ? " Ajusta la cantidad, quítalo del ticket o surte el inventario; no se cobró nada."
      : " Ajusta la cantidad en tu carrito o quita ese producto e inténtalo de nuevo; no se hizo ningún cargo."
  return head + parts.join(" ") + tail
}
