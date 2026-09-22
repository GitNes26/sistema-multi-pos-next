/**
 * Genera la descripción final de una promoción a partir de sus campos.
 * Módulo compartido: funciona tanto en server (Node) como en client (browser).
 */

const SCOPE_LABELS: Record<string, string> = {
  order: "todo el pedido",
  category: "categoría",
  product: "producto",
  variant: "variante",
};

const WEEKDAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export interface DescriptionInput {
  benefit?: string;
  scope?: string;
  value?: number;
  buyQuantity?: number;
  getQuantity?: number;
  minAmount?: number;
  minQuantity?: number;
  startsAt?: string | null;
  endsAt?: string | null;
  weekdays?: number[] | string | null;
  startTime?: string | null;
  endTime?: string | null;
  couponCode?: string | null;
  requiresCustomer?: boolean;
  exclusive?: boolean;
  maxUses?: number | null;
  maxUsesPerCustomer?: number | null;
  targetLocations?: string[];
  targetCategories?: string[];
  targetProducts?: string[];
  targetVariants?: string[];
  rewardVariants?: string[];
}

function parseWeekdays(value: number[] | string | null | undefined): number[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(Number);
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(Number) : [];
  } catch {
    return [];
  }
}

export function generateDescriptionFinal(data: DescriptionInput): string {
  const benefit = data.benefit ?? "";
  const scope = data.scope ?? "order";
  const value = Number(data.value ?? 0);
  const buyQ = Number(data.buyQuantity ?? 0);
  const getQ = Number(data.getQuantity ?? 0);
  const minAmount = Number(data.minAmount ?? 0);
  const minQty = Number(data.minQuantity ?? 0);
  const weekdays = parseWeekdays(data.weekdays);
  const startTime = data.startTime || null;
  const endTime = data.endTime || null;
  const startsAt = data.startsAt || null;
  const endsAt = data.endsAt || null;

  const parts: string[] = [];

  // 1. What
  switch (benefit) {
    case "percent_off":
      parts.push(`${value}% de descuento en ${SCOPE_LABELS[scope] ?? scope}`);
      break;
    case "amount_off":
      parts.push(`$${value} de descuento en ${SCOPE_LABELS[scope] ?? scope}`);
      break;
    case "fixed_price":
      parts.push(
        `Precio fijo de $${value} en ${SCOPE_LABELS[scope] ?? scope}`,
      );
      break;
    case "buy_x_get_y":
      parts.push(
        `Lleva ${buyQ} y recibe ${getQ} gratis dentro de cada paquete en ${SCOPE_LABELS[scope] ?? scope}`,
      );
      break;
    case "free_item":
      parts.push(`Producto gratis en ${SCOPE_LABELS[scope] ?? scope}`);
      break;
    case "next_purchase_coupon":
      parts.push(value > 0 ? `Cupón de $${value} para tu próxima compra` : "Cupón para tu próxima compra");
      break;
  }

  // 2. When
  const dateRange: string[] = [];
  if (startsAt) {
    const d = new Date(startsAt);
    if (!isNaN(d.getTime())) dateRange.push(`desde ${d.toLocaleDateString("es-MX")}`);
  }
  if (endsAt) {
    const d = new Date(endsAt);
    if (!isNaN(d.getTime())) dateRange.push(`hasta ${d.toLocaleDateString("es-MX")}`);
  }
  if (dateRange.length) parts.push(dateRange.join(" "));

  if (weekdays.length > 0) {
    parts.push(
      `los ${weekdays.map((d) => WEEKDAY_NAMES[d] ?? d).join(", ")}`,
    );
  }

  const timeRange: string[] = [];
  if (startTime) timeRange.push(`de ${startTime}`);
  if (endTime) timeRange.push(`hasta ${endTime}`);
  if (timeRange.length) parts.push(timeRange.join(" "));

  // 3. Conditions
  if (minAmount > 0) parts.push(`compra mínima de $${minAmount}`);
  if (minQty > 0) parts.push(`mínimo ${minQty} pieza(s)`);
  if (data.couponCode) parts.push(`usa el cupón ${data.couponCode}`);
  if (data.requiresCustomer) parts.push("exclusiva para clientes registrados");
  if (data.maxUsesPerCustomer) parts.push(`máximo ${data.maxUsesPerCustomer} uso(s) por cliente`);
  if (data.maxUses) parts.push(`limitada a ${data.maxUses} uso(s) en total`);
  if (data.exclusive) parts.push("no se combina con otras promociones");
  if (data.targetLocations?.length) parts.push(`válida en ${data.targetLocations.length} sucursal(es) seleccionada(s)`);
  const targetCount = scope === "category" ? data.targetCategories?.length : scope === "product" ? data.targetProducts?.length : scope === "variant" ? data.targetVariants?.length : 0;
  if (targetCount) parts.push(`aplica a ${targetCount} ${scope === "category" ? "categoría(s)" : scope === "product" ? "producto(s)" : "variante(s)"} seleccionado(s)`);
  if (benefit === "free_item" && data.rewardVariants?.length) parts.push(`obsequio entre ${data.rewardVariants.length} variante(s) seleccionada(s)`);

  return parts.length ? parts.join(". ") + "." : "Selecciona un beneficio para ver cómo se explicará la promoción.";
}
