"use client"

import { useEffect, useRef, useState } from "react"
import { animate, motion, useMotionValue, useTransform } from "framer-motion"
import { ArrowRight, Check, Lock, ShoppingBag, Loader2, ArrowRightLeft, ShieldCheck, CreditCard } from "lucide-react"
import { haptic } from "@/lib/haptics"
import { cn } from "@/lib/utils"

type SlideAction = "payment" | "transfer" | "approval" | "confirm"

interface SlideToPayProps {
  onConfirm: () => void | boolean | Promise<void | boolean>
  label?: string
  hint?: string
  action?: SlideAction
  className?: string
  disabled?: boolean
  empty?: boolean
  loading?: boolean
}

const THRESHOLD = 0.82
const ICONS = { payment: CreditCard, transfer: ArrowRightLeft, approval: ShieldCheck, confirm: Check }
const ACTION_LABELS = { payment: "Pagar", transfer: "Transferir", approval: "Aprobar", confirm: "Confirmar" }

export function SlideToPay({ onConfirm, label, hint = "Desliza hasta el final para confirmar", action = "payment", className, disabled = false, empty = false, loading: controlledLoading }: SlideToPayProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const [travel, setTravel] = useState(0)
  const [internalLoading, setInternalLoading] = useState(false)
  const [complete, setComplete] = useState(false)
  const loading = controlledLoading ?? internalLoading
  const blocked = disabled || empty || loading || complete
  const progress = useTransform(x, [0, Math.max(1, travel)], [0, 1])
  const fill = useTransform(progress, [0, 1], ["8%", "100%"])
  const textOpacity = useTransform(progress, [0, 0.65], [1, 0.15])
  const ActionIcon = ICONS[action]
  const visibleLabel = label ?? `Desliza para ${ACTION_LABELS[action].toLowerCase()}`

  useEffect(() => {
    const measure = () => setTravel(Math.max(0, (trackRef.current?.clientWidth ?? 0) - 64))
    measure()
    const observer = new ResizeObserver(measure)
    if (trackRef.current) observer.observe(trackRef.current)
    return () => observer.disconnect()
  }, [])

  const reset = () => animate(x, 0, { type: "spring", stiffness: 420, damping: 34 })
  const confirm = async () => {
    if (blocked) return
    setInternalLoading(true)
    animate(x, travel, { duration: 0.18 })
    haptic.success()
    try {
      const result = await onConfirm()
      if (result === false) { reset(); return }
      setComplete(true)
      window.setTimeout(() => { setComplete(false); reset() }, 900)
    } catch (error) {
      reset()
      throw error
    } finally {
      setInternalLoading(false)
    }
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div ref={trackRef} className={cn("relative h-16 w-full overflow-hidden rounded-2xl border bg-muted/70 p-1 shadow-inner select-none", !blocked && "border-primary/25", blocked && "opacity-65")}>
        <motion.div className="absolute inset-y-1 left-1 rounded-xl bg-primary/15" style={{ width: fill }} />
        <motion.div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-16 text-center" style={{ opacity: textOpacity }}>
          <span className="text-sm font-semibold">{empty ? "No hay elementos para procesar" : loading ? "Procesando…" : complete ? "Acción confirmada" : visibleLabel}</span>
          {!empty && !loading && !complete && <span className="text-xs text-muted-foreground">{hint}</span>}
        </motion.div>
        <motion.button
          type="button"
          style={{ x }}
          drag={blocked ? false : "x"}
          dragConstraints={{ left: 0, right: travel }}
          dragElastic={0.03}
          dragMomentum={false}
          onDragStart={() => haptic.light()}
          onDragEnd={(_, info) => {
            const reached = travel > 0 && (info.offset.x / travel >= THRESHOLD || info.velocity.x > 650)
            if (reached) void confirm()
            else reset()
          }}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && !blocked) { event.preventDefault(); void confirm() }
          }}
          aria-label={empty ? "Acción no disponible" : visibleLabel}
          aria-disabled={blocked}
          disabled={blocked}
          className="absolute left-1 top-1 z-10 flex size-14 touch-none items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="size-5 animate-spin" /> : complete ? <Check className="size-5" /> : empty ? <ShoppingBag className="size-5" /> : disabled ? <Lock className="size-5" /> : <><ActionIcon className="size-5" /><ArrowRight className="absolute right-1 size-3 opacity-65" /></>}
        </motion.button>
      </div>
    </div>
  )
}
