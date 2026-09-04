"use client"

import { motion, useMotionValue, useTransform, animate } from "framer-motion"
import { ArrowRight, Check, Lock } from "lucide-react"
import { haptic } from "@/lib/haptics"
import { cn } from "@/lib/utils"

interface SlideToPayProps {
  onConfirm: () => void
  label?: string
  className?: string
  disabled?: boolean
}

/**
 * SlideToPay — A draggable slider that confirms an action when swiped right.
 *
 * The thumb must be dragged from left to right past 80% to trigger onConfirm.
 * If released before the threshold, it springs back.
 */
export function SlideToPay({
  onConfirm,
  label = "Desliza para pagar",
  className,
  disabled = false,
}: SlideToPayProps) {
  const x = useMotionValue(0)
  const trackRef = { current: 0 }

  // Visual transforms based on drag progress
  const bg = useTransform(x, [0, 140], ["hsl(var(--muted))", "hsl(340 80% 55%)"])
  const iconOpacity = useTransform(x, [0, 60, 120], [0, 0.5, 1])
  const labelOpacity = useTransform(x, [0, 40, 80], [1, 0.5, 0])
  const thumbScale = useTransform(x, [0, 140], [1, 1.05])

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    const threshold = 120
    const velocityThreshold = 400

    if (
      !disabled &&
      (info.offset.x > threshold || info.velocity.x > velocityThreshold)
    ) {
      haptic.heavy()
      onConfirm()
    } else {
      // Spring back
      animate(x, 0, { type: "spring", stiffness: 400, damping: 30 })
    }
  }

  return (
    <div className={cn("relative h-14 w-full select-none", className)}>
      {/* Track background — changes color as you drag */}
      <motion.div
        style={{ backgroundColor: bg }}
        className="absolute inset-0 rounded-full overflow-hidden"
      >
        {/* Checkmark that fades in as you drag */}
        <motion.div
          style={{ opacity: iconOpacity }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white"
        >
          <Check className="size-5" strokeWidth={3} />
        </motion.div>

        {/* Label that fades out as you drag */}
        <motion.div
          style={{ opacity: labelOpacity }}
          className="absolute inset-0 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground pointer-events-none"
        >
          <Lock className="size-4" />
          <span>{label}</span>
        </motion.div>
      </motion.div>

      {/* Draggable thumb */}
      <motion.div
        style={{ x, scale: thumbScale }}
        drag="x"
        dragConstraints={{ left: 0, right: 160 }}
        dragElastic={0.1}
        dragMomentum={false}
        onDragEnd={handleDragEnd}
        whileTap={{ scale: 1.08 }}
        className={cn(
          "absolute left-1 top-1 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg cursor-grab active:cursor-grabbing",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <ArrowRight className="size-5 text-foreground" />
      </motion.div>
    </div>
  )
}
