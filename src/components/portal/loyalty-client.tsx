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

const KIND_CONFIG: Record<string, { label: string; icon: typeof Star; color: string }> = {
  earn: { label: "Ganados", icon: TrendingUp, color: "text-emerald-500 bg-emerald-500/10" },
  redeem: { label: "Canjeados", icon: Gift, color: "text-amber-500 bg-amber-500/10" },
  adjust: { label: "Ajuste", icon: Star, color: "text-blue-500 bg-blue-500/10" },
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
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 p-6 text-primary-foreground shadow-lg shadow-primary/20"
        >
          <div className="absolute -right-8 -top-8 size-32 rounded-full bg-white/10" />
          <div className="absolute -bottom-6 -left-6 size-24 rounded-full bg-white/5" />
          <div className="absolute right-12 bottom-4 size-16 rounded-full bg-white/5" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="size-4 opacity-80" />
              <p className="text-xs font-medium opacity-80">Tus puntos</p>
            </div>
            <motion.p
              className="text-4xl font-extrabold tracking-tight"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            >
              {money(data.points)}
            </motion.p>
            <p className="mt-1 text-xs opacity-60">Puntos acumulados</p>
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
                    transition={{ delay: idx * 0.03 }}
                  >
                    <SwipeableRow onDelete={() => {}}>
                      <div className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-sm">
                        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", config.color)}>
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{config.label}</p>
                          {t.note && <p className="text-xs text-muted-foreground truncate">{t.note}</p>}
                          <p className="text-[11px] text-muted-foreground/60">
                            {new Date(t.createdAt).toLocaleDateString("es-MX", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <span className={cn("text-sm font-bold tabular-nums", t.points >= 0 ? "text-emerald-600" : "text-destructive")}>
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
