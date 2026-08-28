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
        `Lleva ${buyQ} y llévate ${getQ} gratis en ${SCOPE_LABELS[scope] ?? scope}`,
      );
      break;
    case "free_item":
      parts.push(`Producto gratis en ${SCOPE_LABELS[scope] ?? scope}`);
      break;
    case "next_purchase_coupon":
      parts.push(
        `Cupón de $${value || "10%"} para tu próxima compra`,
      );
      break;
  }

  // 2. When
  const dateRange: string[] = [];
  if (startsAt)
    dateRange.push(
      `desde ${new Date(startsAt + "T00:00:00").toLocaleDateString("es-MX")}`,
    );
  if (endsAt)
    dateRange.push(
      `hasta ${new Date(endsAt + "T00:00:00").toLocaleDateString("es-MX")}`,
    );
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

  return parts.join(". ") + ".";
}
