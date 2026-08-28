/**
 * Motor de evaluación de promociones para pedidos del portal.
 * Adaptado de src/lib/pos/pricing.ts para trabajar con datos del portal.
 */

import { round2, round3 } from "@/lib/pos/money";
import { getWeekdaysNumber } from "@/lib/pos/pricing-schedule";
import type { PortalOrderInput } from "./server";

export interface PortalPromotionTarget {
  kind: string;
  targetId: string;
}

export interface PortalPromotion {
  id: string;
  name: string;
  benefit: string;
  scope: string;
  value: number;
  buyQuantity: number;
  getQuantity: number;
  minAmount: number;
  minQuantity: number;
  couponCode: string | null;
  requiresCustomer: boolean;
  priority: number;
  exclusive: boolean;
  maxUses: number | null;
  usesCount: number;
  startsAt: string | null;
  endsAt: string | null;
  weekdays: string | null;
  startTime: string | null;
  endTime: string | null;
  targets: PortalPromotionTarget[];
}

interface PromoLine {
  productId: string;
  variantId: string | null;
  categoryId: string | null;
  qty: number;
  unitPrice: number;
}

interface PromoResult {
  discount: number;
  label: string;
  promotionId: string | null;
  /** Líneas de descuento individuales para desglose. */
  discounts: { label: string; amount: number; promotionId?: string }[];
}

function withinSchedule(p: PortalPromotion, now: Date): boolean {
  if (p.startsAt && now.getTime() < new Date(p.startsAt).getTime()) return false;
  if (p.endsAt && now.getTime() > new Date(p.endsAt).getTime()) return false;
  const weekdays = getWeekdaysNumber(p.weekdays);
  if (weekdays.length && !weekdays.includes(now.getDay())) return false;
  if (p.startTime) {
    const hm = p.startTime.split(":").map(Number);
    const start = hm[0] * 60 + (hm[1] ?? 0);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin < start) return false;
  }
  if (p.endTime) {
    const hm = p.endTime.split(":").map(Number);
    const end = hm[0] * 60 + (hm[1] ?? 0);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin > end) return false;
  }
  return true;
}

function targetIds(p: PortalPromotion, kind: string): Set<string> {
  const set = new Set<string>();
  for (const t of p.targets) {
    if (t.kind === kind || (t.kind === "product" && kind === "category"))
      set.add(t.targetId);
  }
  return set;
}

function applicableLines(p: PortalPromotion, lines: PromoLine[]): PromoLine[] {
  switch (p.scope) {
    case "order":
      return lines;
    case "category": {
      const cats = targetIds(p, "category");
      return lines.filter((l) => l.categoryId && cats.has(l.categoryId));
    }
    case "product": {
      const products = targetIds(p, "product");
      return lines.filter((l) => products.has(l.productId));
    }
    case "variant": {
      const variants = targetIds(p, "variant");
      return lines.filter((l) => l.variantId && variants.has(l.variantId));
    }
    default:
      return [];
  }
}

function promoDiscountAmount(
  p: PortalPromotion,
  lines: PromoLine[],
): number {
  if (p.requiresCustomer) return 0; // portal siempre tiene customer, pero lo validamos aparte
  if (p.maxUses != null && p.usesCount >= p.maxUses) return 0;

  const applicable = applicableLines(p, lines);
  if (!applicable.length) return 0;

  const baseAmount = applicable.reduce(
    (acc, l) => round2(acc + l.qty * l.unitPrice),
    0,
  );
  const baseQty = round3(applicable.reduce((acc, l) => acc + l.qty, 0));

  if (p.minAmount > 0 && baseAmount < p.minAmount) return 0;
  if (p.minQuantity > 0 && baseQty < p.minQuantity) return 0;

  switch (p.benefit) {
    case "percent_off":
      return round2(baseAmount * (p.value / 100));
    case "amount_off":
      return Math.min(p.value, round2(baseAmount));
    case "fixed_price":
      return round2(
        applicable.reduce(
          (acc, l) => acc + Math.max(0, l.unitPrice - p.value) * l.qty,
          0,
        ),
      );
    case "buy_x_get_y": {
      if (!p.buyQuantity) return 0;
      return round2(
        applicable.reduce((acc, l) => {
          const cycles = Math.floor(l.qty / (p.buyQuantity + p.getQuantity));
          return acc + cycles * p.getQuantity * l.unitPrice;
        }, 0),
      );
    }
    case "free_item": {
      const cheapest = applicable.reduce(
        (best, l) => (l.unitPrice < best ? l.unitPrice : best),
        Infinity,
      );
      return cheapest === Infinity ? 0 : round2(cheapest);
    }
    case "next_purchase_coupon":
      return 0;
    default:
      return 0;
  }
}

/**
 * Evalúa las promociones activas contra un pedido del portal y devuelve
 * el mejor descuento automático (excluye cupones, solo promos sin couponCode).
 */
export function evaluatePortalPromotions(
  promotions: PortalPromotion[],
  items: PortalOrderInput["items"],
  now = new Date(),
): PromoResult {
  const lines: PromoLine[] = items.map((i) => ({
    productId: i.productId,
    variantId: i.variantId,
    categoryId: i.categoryId ?? null,
    qty: i.quantity,
    unitPrice: i.unitPrice,
  }));

  const subtotal = lines.reduce((acc, l) => acc + l.qty * l.unitPrice, 0);
  if (subtotal <= 0) {
    return { discount: 0, label: "", promotionId: null, discounts: [] };
  }

  // Solo promociones automáticas (sin couponCode) dentro de schedule
  const evaluated = promotions
    .filter((p) => p.couponCode == null && withinSchedule(p, now))
    .map((p) => ({ p, amount: promoDiscountAmount(p, lines) }))
    .filter((x) => x.amount > 0);

  if (!evaluated.length) {
    return { discount: 0, label: "", promotionId: null, discounts: [] };
  }

  // Si existe una exclusiva, solo considerar esa
  const exclusive = evaluated.filter((x) => p_exclusive(x.p));
  const chosen = [...(exclusive.length ? exclusive : evaluated)].sort(
    (a, b) => b.amount - a.amount,
  )[0];

  const discount = round2(Math.min(chosen.amount, subtotal));
  return {
    discount,
    label: chosen.p.name,
    promotionId: chosen.p.id,
    discounts: [
      { label: chosen.p.name, amount: discount, promotionId: chosen.p.id },
    ],
  };
}

function p_exclusive(p: PortalPromotion): boolean {
  return p.exclusive;
}
