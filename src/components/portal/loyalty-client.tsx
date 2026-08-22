"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Star, TrendingUp, Gift, Clock, Sparkles } from "lucide-react"
import { portalApi, type LoyaltyData } from "@/lib/portal/client"
import { money } from "@/lib/pos/money"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const KIND_CONFIG: Record<string, { label: string; icon: typeof Star; color: string }> = {
  earn: { label: "Ganados", icon: TrendingUp, color: "text-emerald-500 bg-emerald-500/10" },
  redeem: { label: "Canjeados", icon: Gift, color: "text-amber-500 bg-amber-500/10" },
  adjust: { label: "Ajuste", icon: Star, color: "text-blue-500 bg-blue-500/10" },
  expire: { label: "Expirados", icon: Clock, color: "text-destructive bg-destructive/10" },
}

export function LoyaltyClient() {
  const [data, setData] = useState<LoyaltyData | null>(null)

  useEffect(() => {
    let active = true
    portalApi
      .loyalty()
      .then((d) => active && setData(d))
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  if (!data) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      {/* Points hero card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 p-5 text-primary-foreground shadow-lg shadow-primary/20"
      >
        {/* Decorative circles */}
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

      {/* Transactions */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Historial</h2>
        <div className="space-y-2">
          {data.transactions.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Sin movimientos</p>
          ) : (
            data.transactions.map((t, idx) => {
              const config = KIND_CONFIG[t.kind] ?? KIND_CONFIG.adjust
              const Icon = config.icon
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-3"
                >
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
                </motion.div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
