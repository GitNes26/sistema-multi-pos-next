"use client"

import { useCallback, useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Star, TrendingUp, Gift, Clock, Sparkles, History } from "lucide-react"
import { portalApi, type LoyaltyData } from "@/lib/portal/client"
import { money } from "@/lib/pos/money"
import { Skeleton } from "@/components/ui/skeleton"
import { PullToRefresh } from "@/components/shared/pull-to-refresh"
import { EmptyState } from "@/components/shared/empty-state"
import { SwipeableRow } from "@/components/shared/swipeable-row"
import { cn } from "@/lib/utils"
import { STAGGER } from "@/lib/animation-tokens"

const KIND_CONFIG: Record<string, { label: string; icon: typeof Star; color: string }> = {
  earn: { label: "Ganados", icon: TrendingUp, color: "text-success-ink bg-success/10" },
  redeem: { label: "Canjeados", icon: Gift, color: "text-warning-ink bg-warning/10" },
  adjust: { label: "Ajuste", icon: Star, color: "text-info-ink bg-info/10" },
  expire: { label: "Expirados", icon: Clock, color: "text-destructive bg-destructive/10" },
}

export function LoyaltyClient() {
  const [data, setData] = useState<LoyaltyData | null>(null)

  const load = useCallback(async () => {
    const d = await portalApi.loyalty()
    setData(d)
  }, [])

  useEffect(() => {
    load().catch(() => undefined)
  }, [load])

  if (!data) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-8 w-32 rounded-xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <PullToRefresh onRefresh={load}>
      <div className="space-y-4 p-4">
        {/* Points hero card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground shadow-e2"
        >
          <svg aria-hidden viewBox="0 0 200 200" className="absolute -top-16 -right-16 size-56 opacity-20">
            {[96, 76, 56, 36].map((r) => (
              <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="currentColor" strokeWidth="1.5" />
            ))}
          </svg>

          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="size-4 opacity-80" />
              <p className="text-sm font-medium opacity-85">Dinero electrónico disponible</p>
            </div>
            <motion.p
              className="font-heading text-4xl font-bold tracking-tight tabular"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
            >
              {money(data.points * data.pointValue)}
            </motion.p>
            <p className="mt-1.5 text-sm opacity-75 tabular">
              {Math.floor(data.points)} pts · valor {money(data.pointValue)} por punto
            </p>
          </div>
        </motion.div>

        {/* Transactions header */}
        <div className="flex items-center gap-2">
          <History className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Historial</h2>
        </div>

        {/* Transactions */}
        <div className="space-y-2">
          {data.transactions.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Sin movimientos"
              description="Tus puntos aparecerán aquí cuando acumules o canjees."
            />
          ) : (
            <AnimatePresence>
              {data.transactions.map((t, idx) => {
                const config = KIND_CONFIG[t.kind] ?? KIND_CONFIG.adjust
                const Icon = config.icon
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * STAGGER.COMPACT }}
                  >
                    <SwipeableRow onDelete={() => {}}>
                      <div className="flex items-center gap-3 rounded-2xl border bg-card p-3.5">
                        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", config.color)}>
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{config.label}</p>
                          {t.note && <p className="text-xs text-muted-foreground truncate">{t.note}</p>}
                          <p className="text-xs text-muted-foreground/60">
                            {t.ticket != null && <span className="font-semibold text-foreground/70">#{t.ticket} · </span>}
                            {new Date(t.createdAt).toLocaleDateString("es-MX", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <span className={cn("text-sm font-bold tabular-nums", t.points >= 0 ? "text-success-ink" : "text-destructive")}>
                          {t.points >= 0 ? "+" : ""}{money(t.points)}
                        </span>
                      </div>
                    </SwipeableRow>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </PullToRefresh>
  )
}
