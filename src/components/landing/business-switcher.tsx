"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowRight, CalendarClock, Check, KeyRound, Layers, Store, UtensilsCrossed, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BUSINESS_MODES } from "@/lib/business-modes"
import type { BusinessMode } from "@/lib/auth/options"
import { cn } from "@/lib/utils"

const ICONS: Record<BusinessMode, LucideIcon> = {
  retail: Store,
  food_service: UtensilsCrossed,
  services: CalendarClock,
  rental: KeyRound,
  hybrid: Layers,
}

const ORDER: BusinessMode[] = ["retail", "food_service", "services", "rental", "hybrid"]

// Selector de tipo de negocio: la misma fuente (BUSINESS_MODES) que usa el
// onboarding, para que la portada nunca prometa algo distinto al sistema.
export function BusinessSwitcher({ ctaHref }: { ctaHref: string }) {
  const [mode, setMode] = useState<BusinessMode>("retail")
  const info = BUSINESS_MODES[mode]
  const Icon = ICONS[mode]

  return (
    <div>
      <div
        role="tablist"
        aria-label="Tipo de negocio"
        className="-mx-4 flex snap-x gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {ORDER.map((id) => {
          const TabIcon = ICONS[id]
          const selected = id === mode
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls="business-panel"
              onClick={() => setMode(id)}
              className={cn(
                "press relative flex h-11 shrink-0 snap-start items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
                selected ? "border-transparent text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {selected && (
                <motion.span
                  layoutId="business-tab"
                  className="absolute inset-0 -z-0 rounded-full bg-primary shadow-e1"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <TabIcon className="relative size-4" />
              <span className="relative whitespace-nowrap">{BUSINESS_MODES[id].label}</span>
            </button>
          )
        })}
      </div>

      <div id="business-panel" role="tabpanel" className="mt-6 overflow-hidden rounded-3xl border bg-card shadow-e1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-12"
          >
            <div>
              <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <Icon className="size-7" />
              </span>
              <h3 className="mt-5 font-heading text-2xl font-semibold tracking-tight">{info.label}</h3>
              <p className="mt-3 text-pretty text-muted-foreground">{info.description}</p>
              <Button asChild variant="outline" className="mt-6 h-11 rounded-xl desk:h-10">
                <a href={ctaHref} target="_blank" rel="noopener noreferrer">
                  Quiero verlo en mi negocio <ArrowRight />
                </a>
              </Button>
            </div>
            <ul className="grid content-start gap-2 sm:grid-cols-2">
              {info.features.map((f, i) => (
                <motion.li
                  key={f}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * i, duration: 0.3 }}
                  className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3 text-sm font-medium"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  {f}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
