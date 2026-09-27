"use client"

import { motion, useReducedMotion } from "framer-motion"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// Encabezado de las secciones del portal. Cada sección tiene su propio tono
// e ícono para que Pedidos, Listas, Crédito, Favoritos… no se vean iguales.

export type PortalTone = "primary" | "info" | "success" | "warning" | "danger" | "neutral"

const TONES: Record<PortalTone, { bg: string; icon: string; glow: string }> = {
  primary: { bg: "from-primary/15 via-primary/5", icon: "bg-primary text-primary-foreground", glow: "bg-primary/25" },
  info: { bg: "from-info/15 via-info/5", icon: "bg-info text-white", glow: "bg-info/25" },
  success: { bg: "from-success/15 via-success/5", icon: "bg-success text-white", glow: "bg-success/25" },
  warning: { bg: "from-warning/20 via-warning/5", icon: "bg-warning text-warning-foreground", glow: "bg-warning/30" },
  danger: { bg: "from-destructive/15 via-destructive/5", icon: "bg-destructive text-white", glow: "bg-destructive/25" },
  neutral: { bg: "from-muted via-muted/40", icon: "bg-foreground text-background", glow: "bg-foreground/10" },
}

export interface PortalHeroStat {
  label: string
  value: React.ReactNode
}

export function PortalHero({
  icon: Icon,
  title,
  subtitle,
  tone = "primary",
  action,
  stats,
  children,
}: {
  icon: LucideIcon
  title: string
  subtitle?: React.ReactNode
  tone?: PortalTone
  action?: React.ReactNode
  stats?: PortalHeroStat[]
  children?: React.ReactNode
}) {
  const t = TONES[tone]
  const reduce = useReducedMotion()
  return (
    <section className={cn("relative overflow-hidden rounded-3xl border bg-gradient-to-br to-transparent p-4", t.bg)}>
      <div aria-hidden className={cn("pointer-events-none absolute -right-10 -top-12 size-40 rounded-full blur-3xl", t.glow)} />
      <div className="relative flex items-start gap-3">
        <motion.span
          initial={reduce ? false : { scale: 0.6, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className={cn("grid size-12 shrink-0 place-items-center rounded-2xl shadow-e2", t.icon)}
        >
          <Icon className="size-6" />
        </motion.span>
        <h1 className="min-w-0 flex-1 self-center font-heading text-xl font-semibold leading-tight tracking-tight">{title}</h1>
        {action && <div className="shrink-0 self-center">{action}</div>}
      </div>
      {subtitle && <p className="relative mt-2 text-sm text-muted-foreground">{subtitle}</p>}
      {stats && stats.length > 0 && (
        <div className={cn("relative mt-4 grid gap-2", stats.length >= 3 ? "grid-cols-3" : "grid-cols-2")}>
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl bg-background/70 px-3 py-2 backdrop-blur">
              <p className="font-heading text-lg font-semibold tabular-nums">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}
      {children && <div className="relative mt-4">{children}</div>}
    </section>
  )
}
