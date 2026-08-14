import type { $Enums } from "@prisma/client"
import type { PosCustomer, PosPromotion } from "@/types/pos"
import { POINTS_PER_PESO, LOYALTY_EARN_RATE } from "./config"
import { round2, round3 } from "./money"
import { getWeekdaysNumber } from "./pricing-schedule"

export interface PricingLine {
  key: string
  qty: number
  unitPrice: number
  taxRate: number
  productId: string
  variantId: string | null
  categoryId: string | null
}

export type ManualDiscount = {
  kind: "percent" | "amount"
  value: number
} | null

export interface DiscountLine {
  label: string
  amount: number
  promotionId?: string
  kind: "promo" | "manual" | "coupon"
}

export interface CouponResult {
  label: string
  amount: number
  percent?: number
  couponId?: string
  promotionId?: string
}

export interface Totals {
  subtotal: number
  discounts: DiscountLine[]
  discountTotal: number
  tax: number
  total: number
  pointsRedeemedValue: number
  payable: number
  pointsEarned: number
}

export interface PricingInput {
  lines: PricingLine[]
  promotions: PosPromotion[]
  customer: PosCustomer | null
  manualDiscount: ManualDiscount
  coupon: CouponResult | null
  pointsRedeemedValue: number
}

function withinSchedule(p: PosPromotion, now: Date): boolean {
  if (p.startsAt && now.getTime() < new Date(p.startsAt).getTime()) return false
  if (p.endsAt && now.getTime() > new Date(p.endsAt).getTime()) return false
  const weekdays = getWeekdaysNumber(p.weekdays)
  if (weekdays.length && !weekdays.includes(now.getDay())) return false
  if (p.startTime) {
    const hm = p.startTime.split(":").map(Number)
    const start = hm[0] * 60 + (hm[1] ?? 0)
    const nowMin = now.getHours() * 60 + now.getMinutes()
    if (nowMin < start) return false
  }
  if (p.endTime) {
    const hm = p.endTime.split(":").map(Number)
    const end = hm[0] * 60 + (hm[1] ?? 0)
    const nowMin = now.getHours() * 60 + now.getMinutes()
    if (nowMin > end) return false
  }
  return true
}

function targetIds(
  p: PosPromotion,
  kind: $Enums.PromotionTargetKind
): Set<string> {
  const set = new Set<string>()
  for (const t of p.targets) {
    if (t.kind === kind || (t.kind === "product" && kind === "category"))
      set.add(t.targetId)
  }
  return set
}

function applicableLines(p: PosPromotion, lines: PricingLine[]): PricingLine[] {
  switch (p.scope) {
    case "order":
      return lines
    case "category": {
      const cats = targetIds(p, "category")
      return lines.filter((l) => l.categoryId && cats.has(l.categoryId))
    }
    case "product": {
      const products = targetIds(p, "product")
      return lines.filter((l) => products.has(l.productId))
    }
    case "variant": {
      const variants = targetIds(p, "variant")
      return lines.filter((l) => l.variantId && variants.has(l.variantId))
    }
    default:
      return []
  }
}

function promoDiscountAmount(
  p: PosPromotion,
  lines: PricingLine[],
  customer: PosCustomer | null
): number {
  if (p.requiresCustomer && !customer) return 0
  if (p.maxUses != null && p.usesCount >= p.maxUses) return 0

  const applicable = applicableLines(p, lines)
  if (!applicable.length) return 0

  const baseAmount = applicable.reduce(
    (acc, l) => round2(acc + l.qty * l.unitPrice),
    0
  )
  const baseQty = round3(applicable.reduce((acc, l) => acc + l.qty, 0))

  if (p.minAmount > 0 && baseAmount < p.minAmount) return 0
  if (p.minQuantity > 0 && baseQty < p.minQuantity) return 0

  switch (p.benefit) {
    case "percent_off":
      return round2(baseAmount * (p.value / 100))
    case "amount_off":
      return Math.min(p.value, round2(baseAmount))
    case "fixed_price": {
      return round2(
        applicable.reduce(
          (acc, l) => acc + Math.max(0, l.unitPrice - p.value) * l.qty,
          0
        )
      )
    }
    case "buy_x_get_y": {
      if (!p.buyQuantity) return 0
      return round2(
        applicable.reduce((acc, l) => {
          const cycles = Math.floor(l.qty / (p.buyQuantity + p.getQuantity))
          return acc + cycles * p.getQuantity * l.unitPrice
        }, 0)
      )
    }
    case "free_item": {
      const cheapest = applicable.reduce(
        (best, l) => (l.unitPrice < best ? l.unitPrice : best),
        Infinity
      )
      return cheapest === Infinity ? 0 : round2(cheapest)
    }
    case "next_purchase_coupon":
      return 0
    default:
      return 0
  }
}

// Selecciona la mejor promoció automática (se ignora next_purchase_coupon). Si
// existe una elegible marcada como exclusiva, prevalece sobre las demás.
export function bestAutoPromotion(
  promotions: PosPromotion[],
  lines: PricingLine[],
  customer: PosCustomer | null,
  now = new Date()
): { discount: number; label: string; promotionId: string | null } {
  const evaluated = promotions
    .filter((p) => p.couponCode == null && withinSchedule(p, now))
    .map((p) => ({ p, amount: promoDiscountAmount(p, lines, customer) }))
    .filter((x) => x.amount > 0)

  if (!evaluated.length) return { discount: 0, label: "", promotionId: null }

  const exclusive = evaluated.filter((x) => x.p.exclusive)
  const chosen = [...(exclusive.length ? exclusive : evaluated)].sort(
    (a, b) => b.amount - a.amount
  )[0]

  return {
    discount: round2(chosen.amount),
    label: chosen.p.name,
    promotionId: chosen.p.id,
  }
}

const WEEKDAYS_ES = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"]

export function promotionScheduleLabel(p: PosPromotion): string | null {
  const weekdays = getWeekdaysNumber(p.weekdays)
    .map((d) => WEEKDAYS_ES[d])
    .join(", ")
  if (p.startTime || p.endTime) {
    return [
      weekdays && `días ${weekdays}`,
      p.startTime && `desde ${p.startTime}`,
      p.endTime && `hasta ${p.endTime}`,
    ]
      .filter(Boolean)
      .join(" · ")
  }
  return weekdays ? `días ${weekdays}` : null
}

export function computeTotals(input: PricingInput): Totals {
  const {
    lines,
    promotions,
    customer,
    manualDiscount,
    coupon,
    pointsRedeemedValue,
  } = input

  const subtotal = round2(
    lines.reduce((acc, l) => acc + l.qty * l.unitPrice, 0)
  )
  if (subtotal <= 0) {
    return {
      subtotal: 0,
      discounts: [],
      discountTotal: 0,
      tax: 0,
      total: 0,
      pointsRedeemedValue: 0,
      payable: 0,
      pointsEarned: 0,
    }
  }

  const manual =
    manualDiscount && manualDiscount.value > 0
      ? round2(
          manualDiscount.kind === "percent"
            ? subtotal * (manualDiscount.value / 100)
            : manualDiscount.value
        )
      : 0
  const couponAmount =
    coupon && coupon.percent != null
      ? round2(subtotal * (coupon.percent / 100))
      : coupon && coupon.amount > 0
        ? round2(coupon.amount)
        : 0
  const promo = bestAutoPromotion(promotions, lines, customer)
  const promoAmount = round2(
    Math.min(promo.discount, Math.max(0, subtotal - manual - couponAmount))
  )

  const discounts: DiscountLine[] = []
  if (promoAmount > 0)
    discounts.push({
      label: promo.label,
      amount: promoAmount,
      promotionId: promo.promotionId ?? undefined,
      kind: "promo",
    })
  if (manual > 0)
    discounts.push({
      label: "Descuento manual",
      amount: manual,
      kind: "manual",
    })
  if (couponAmount > 0 && coupon)
    discounts.push({
      label: coupon.label,
      amount: couponAmount,
      kind: "coupon",
    })

  const discountTotal = round2(
    Math.min(
      subtotal,
      discounts.reduce((acc, d) => acc + d.amount, 0)
    )
  )

  // Impuestos por línea: el descuento se reparte pro-rata sobre el importe bruto.
  let tax = 0
  for (const l of lines) {
    const cap = (l.qty * l.unitPrice) / subtotal
    const lineNet = Math.max(
      0,
      round2(l.qty * l.unitPrice - discountTotal * cap)
    )
    tax = round2(tax + lineNet * l.taxRate)
  }

  const total = round2(subtotal - discountTotal + tax)
  const pointsValue = round2(pointsRedeemedValue)
  const payable = round2(Math.max(0, total - pointsValue))

  return {
    subtotal,
    discounts,
    discountTotal,
    tax,
    total,
    pointsRedeemedValue: pointsValue,
    payable,
    pointsEarned: customer ? round2(payable * LOYALTY_EARN_RATE) : 0,
  }
}

export function pointsToMoney(points: number): number {
  return round2(points / POINTS_PER_PESO)
}

export function moneyToPoints(moneyAmount: number): number {
  return round2(moneyAmount * POINTS_PER_PESO)
}
