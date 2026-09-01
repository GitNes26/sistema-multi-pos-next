"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface WizardStep {
  id: string
  title: string
}

interface Props {
  steps: WizardStep[]
  children: (ctx: { step: WizardStep; goNext: () => void; goBack: () => void; isFirst: boolean; isLast: boolean }) => React.ReactNode
  onFinish: () => void | Promise<void>
  finishLabel?: string
  loading?: boolean
}

export function WizardShell({ steps, children, onFinish, finishLabel = "Finalizar", loading }: Props) {
  const [cur, setCur] = useState(0)
  const step = steps[cur]

  return (
    <div className="space-y-6">
      {/* Dots */}
      <div className="flex items-center gap-1.5">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1.5">
            <span className={cn("flex size-7 items-center justify-center rounded-full text-xs font-bold transition",
              i === cur ? "bg-primary text-primary-foreground" : i < cur ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
            )}>
              {i < cur ? <Check className="size-3.5" /> : i + 1}
            </span>
            {i < steps.length - 1 && <div className={cn("h-0.5 w-5 rounded-full", i < cur ? "bg-emerald-500" : "bg-muted")} />}
          </div>
        ))}
        <span className="ml-2 text-sm font-semibold">{step.title}</span>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div key={step.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }}>
          {children({ step, goNext: () => setCur((c) => c + 1), goBack: () => setCur((c) => c - 1), isFirst: cur === 0, isLast: cur === steps.length - 1 })}
        </motion.div>
      </AnimatePresence>

      {/* Nav */}
      <div className="flex justify-between border-t pt-4">
        <Button variant="outline" disabled={cur === 0} onClick={() => setCur((c) => c - 1)}>
          <ArrowLeft className="size-4" /> Anterior
        </Button>
        {cur === steps.length - 1 ? (
          <Button onClick={onFinish} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {finishLabel}
          </Button>
        ) : (
          <Button onClick={() => setCur((c) => c + 1)}>
            Siguiente <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
