"use client"

import { motion, useMotionValue, useTransform } from "framer-motion"
import { Trash2 } from "lucide-react"
import { haptic } from "@/lib/haptics"

export function SwipeableRow({
  children,
  onDelete,
  className,
}: {
  children: React.ReactNode
  onDelete: () => void
  className?: string
}) {
  const x = useMotionValue(0)
  const bg = useTransform(x, [-100, -50, 0], ["#ef4444", "#f97316", "rgba(0,0,0,0)"])
  const opacity = useTransform(x, [-100, -50, 0], [1, 0.8, 0])

  return (
    <div className={className ?? "relative overflow-hidden rounded-xl"}>
      <motion.div
        style={{ backgroundColor: bg }}
        className="absolute inset-0 flex items-center justify-end rounded-xl pr-4"
      >
        <motion.div style={{ opacity }} className="flex items-center gap-2 text-white">
          <Trash2 className="size-5" />
        </motion.div>
      </motion.div>

      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={0.1}
        onDragEnd={(_, info) => {
          if (info.offset.x < -80) {
            haptic.heavy()
            onDelete()
          }
        }}
        className="relative bg-background"
      >
        {children}
      </motion.div>
    </div>
  )
}
