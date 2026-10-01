"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Target } from "lucide-react"
import { usePosStore } from "@/stores/pos-store"
import { usePosTotals } from "@/hooks/use-pos-totals"
import { money } from "@/lib/pos/money"

/**
 * Avance hacia promociones por monto mínimo (50 %–99 % del ticket actual).
 * Vive en la base del catálogo para no quitarle espacio a la lista del ticket.
 */
export function PromoProgress() {
  const promotions = usePosStore((s) => s.promotions)
  const t = usePosTotals()
  const now = new Date()
  const near = promotions.filter((p) => {
    if (p.minAmount <= 0 || p.couponCode) return false
    if (p.startsAt && new Date(p.startsAt) > now) return false
    if (p.endsAt && new Date(p.endsAt) < now) return false
    const pct = t.subtotal > 0 ? (t.subtotal / p.minAmount) * 100 : 0
    return pct >= 50 && pct < 100
  })

  return (
    <AnimatePresence initial={false}>
      {near.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="shrink-0 overflow-hidden"
          role="status"
        >
          <div className="space-y-2 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2">
            {near.map((p) => {
              const pct = Math.round((t.subtotal / p.minAmount) * 100)
              const remaining = Math.max(0, p.minAmount - t.subtotal)
              return (
                <div key={p.id} className="flex items-center gap-2.5">
                  <Target className="size-4 shrink-0 text-warning-ink" />
                  <p className="min-w-0 flex-1 truncate text-xs font-medium text-warning-ink">
                    Faltan <span className="font-bold tabular-nums">{money(remaining)}</span> para &ldquo;{p.name}&rdquo;
                  </p>
                  <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-warning/15">
                    <div className="h-full rounded-full bg-warning transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-9 shrink-0 text-right text-xs font-bold tabular-nums text-warning-ink">{pct}%</span>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
