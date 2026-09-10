"use client"

import { motion, useMotionValue, useTransform, animate, useAnimation } from "framer-motion"
import { ArrowRight, Check, Lock, CreditCard, ShoppingBag } from "lucide-react"
import { haptic } from "@/lib/haptics"
import { cn } from "@/lib/utils"

interface SlideToPayProps {
  onConfirm: () => void
  label?: string
  className?: string
  disabled?: boolean
  empty?: boolean
}

const THRESHOLD = 0.78

export function SlideToPay({
  onConfirm,
  label = "Desliza para pagar",
  className,
  disabled = false,
  empty = false,
}: SlideToPayProps) {
  const x = useMotionValue(0)

  // Ancho del track en píxeles, medido en client durante el montaje.
  const trackWidth = useMotionValue(0)

  // Progreso 0..1 calculado sobre el ancho real para que no dependa de
  // constantes de píxeles en pantallas de alta densidad.
  const progress = useTransform(x, [0, trackWidth.get()], [0, 1])

  const conf = useAnimation()

  const trackRefInner = { current: null as HTMLDivElement | null }

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    if (disabled || empty) {
      animate(x, 0, { type: "spring", stiffness: 420, damping: 28 })
      return
    }

    const width = trackWidth.get()
    const dragged = (info.offset.x ?? 0) / width
    const fast = (info.velocity.x ?? 0) > 420

    if (dragged > THRESHOLD || fast) {
      haptic.success()
      conf.start({ opacity: 1, scale: 1 })
      onConfirm()
    } else {
      haptic.medium()
      animate(x, 0, { type: "spring", stiffness: 340, damping: 28 })
    }
  }

  const handleDragStart = () => {
    if (!disabled && !empty) haptic.light()
  }

  const measuredWidth = trackWidth.get()

  return (
    <div
      className={cn("relative h-14 w-full overflow-hidden rounded-full select-none", className)}
      ref={(node) => {
        const div = node as HTMLDivElement | null
        trackRefInner.current = div
        if (div) trackWidth.set(div.getBoundingClientRect().width)
      }}
    >
      {/* Track background */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center rounded-full"
        style={{
          background: empty
            ? "hsl(var(--muted)/0.18)"
            : `linear-gradient(to right, hsl(var(--muted)/0.45) 0%, hsl(340 80% 52%) ${(THRESHOLD * 100).toFixed(0)}%, hsl(340 80% 52%/0.9) 100%)`,
        }}
      >
        {/* Thumb */}
        <motion.div
          style={{ x }}
          drag="x"
          dragConstraints={{ left: 0, right: measuredWidth }}
          dragElastic={0.08}
          dragMomentum={false}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          animate={conf}
          whileDrag={{ scale: 1.06 }}
          whileTap={{ scale: 1.05 }}
          role="slider"
          aria-label={empty ? "Carrito vacío, no se puede pagar" : disabled ? "Pago bloqueado" : label}
          aria-disabled={disabled || empty}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((progress.get() ?? 0) * 100)}
          tabIndex={disabled || empty ? -1 : 0}
          onKeyDown={(e) => {
            if (disabled || empty) return
            // Accesibilidad por teclado: Enter/Espacio confirma (equivalente a deslizar).
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              haptic.success()
              conf.start({ opacity: 1, scale: 1 })
              onConfirm()
            }
          }}
          className={cn(
            "absolute top-1/2 z-10 -translate-y-1/2 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-[0_6px_14px_rgba(0,0,0,0.35)] transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 outline-none",
            !empty && "cursor-grab active:cursor-grabbing",
            disabled && "cursor-not-allowed",
            empty && "cursor-default"
          )}
        >
          {empty ? (
            <ShoppingBag className="size-5 text-muted-foreground/60" />
          ) : disabled ? (
            <Lock className="size-5 text-muted-foreground/70" />
          ) : (
            <ArrowRight className="size-5 text-white" />
          )}
        </motion.div>

        {/* Etiqueta central */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center px-4 pointer-events-none"
        >
          {empty ? (
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
              Carrito vacío
            </span>
          ) : disabled ? (
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground/70">
              Bloqueado
            </span>
          ) : (
            <span className="text-sm font-semibold text-white tracking-tight">{label}</span>
          )}
        </motion.div>

        {/* Mini badge de acción */}
        {!empty && !disabled && (
          <motion.div
            className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white"
            style={{ opacity: 0.6 + 0.4 * Math.min(1, progress.get() ?? 0) }}
          >
            <CreditCard className="size-3" />
            <span>Paga</span>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
