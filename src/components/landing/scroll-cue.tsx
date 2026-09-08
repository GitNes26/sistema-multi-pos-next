"use client"

import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion"
import { ChevronDown } from "lucide-react"

/**
 * Scroll-down cue que aparece al final del hero y se desvanece
 * cuando el usuario hace scroll por primera vez.
 */
export function ScrollCue() {
  const prefersReduced = useReducedMotion()
  const { scrollY } = useScroll()
  const opacity = useTransform(scrollY, [0, 120], [1, 0])
  const y = useTransform(scrollY, [0, 120], [0, -8])

  if (prefersReduced) return null

  return (
    <motion.div
      style={{ opacity, y }}
      className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
    >
      <motion.div
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        className="flex flex-col items-center gap-1.5"
      >
        <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
          Desplázate
        </span>
        <ChevronDown className="size-4 text-slate-400" />
      </motion.div>
    </motion.div>
  )
}
