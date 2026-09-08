"use client"

import { useRef } from "react"
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion"
import type { ReactNode } from "react"

// Parallax sutil del hero (estilo landing SaaS): el contenido se desplaza más
// lento que el scroll y se desvanece al salir de la sección, mientras el
// fondo (HeroBackground) se mueve aún más lento — capas a distintas
// velocidades para dar profundidad. Desactivado con prefers-reduced-motion.
export function HeroParallax({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  })
  const y = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : 90])
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, reduced ? 1 : 0.2])

  return (
    <motion.div ref={ref} style={{ y, opacity }} className={className}>
      {children}
    </motion.div>
  )
}
