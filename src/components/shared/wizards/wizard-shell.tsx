"use client"

import { useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
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
  onBeforeNext?: (step: WizardStep) => boolean | Promise<boolean>
}

const EASE = [0.16, 1, 0.3, 1] as const

export function WizardShell({ steps, children, onFinish, finishLabel = "Finalizar", loading, onBeforeNext }: Props) {
  const [cur, setCur] = useState(0)
  // 1 = avanzar (entra por la derecha), -1 = regresar (entra por la izquierda)
  const [dir, setDir] = useState<1 | -1>(1)
  const reduce = useReducedMotion()
  const step = steps[cur]
  const isLast = cur === steps.length - 1

  const go = (delta: 1 | -1) => {
    setDir(delta)
    setCur((c) => Math.min(Math.max(c + delta, 0), steps.length - 1))
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Progreso: un segmento por paso; el actual se llena con el color primario */}
      <div className="space-y-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-heading text-base font-semibold tracking-tight">{step.title}</h3>
          <span className="shrink-0 text-xs font-medium text-muted-foreground tabular">
            Paso {cur + 1} de {steps.length}
          </span>
        </div>
        <ol className="flex gap-1.5" aria-label="Progreso">
          {steps.map((s, i) => (
            <li
              key={s.id}
              aria-current={i === cur ? "step" : undefined}
              aria-label={`${s.title}${i < cur ? " (completado)" : ""}`}
              className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <span
                className={cn(
                  "absolute inset-0 origin-left rounded-full bg-primary transition-transform duration-500 ease-(--ease-out-expo)",
                  i <= cur ? "scale-x-100" : "scale-x-0",
                  i < cur && "opacity-60"
                )}
              />
            </li>
          ))}
        </ol>
      </div>

      {/* Contenido: desliza en la dirección del avance */}
      <div className="relative min-h-0">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={step.id}
            custom={dir}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 * dir }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24 * dir }}
            transition={{ duration: 0.24, ease: EASE }}
          >
            {children({ step, goNext: () => go(1), goBack: () => go(-1), isFirst: cur === 0, isLast })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navegación: fija abajo en teléfono para que el pulgar la alcance */}
      <div className="sticky bottom-0 -mx-1 flex items-center justify-between gap-3 border-t bg-background/95 px-1 pt-4 pb-[max(0.25rem,env(safe-area-inset-bottom))] supports-backdrop-filter:bg-background/80 supports-backdrop-filter:backdrop-blur">
        <Button variant="ghost" disabled={cur === 0} onClick={() => go(-1)}>
          <ArrowLeft className="size-4" /> Anterior
        </Button>
        {isLast ? (
          <Button onClick={onFinish} disabled={loading} className="min-w-32">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {finishLabel}
          </Button>
        ) : (
          <Button
            className="min-w-32"
            onClick={async () => {
              const canContinue = await onBeforeNext?.(step)
              if (canContinue !== false) go(1)
            }}
          >
            Siguiente <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
