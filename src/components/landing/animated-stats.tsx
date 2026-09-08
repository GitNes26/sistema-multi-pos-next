"use client"

import { useRef, useState, useEffect } from "react"
import { motion, useInView } from "framer-motion"
import { AnimatedNumber } from "@/components/base/animated-number"

interface StatItem {
  value: number
  suffix?: string
  label: string
}

function StatCard({ stat, delay }: { stat: StatItem; delay: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: "-40px" })
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (inView && !started) {
      const timer = setTimeout(() => setStarted(true), delay * 1000)
      return () => clearTimeout(timer)
    }
  }, [inView, delay, started])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
    >
      <p className="text-lg font-bold text-white">
        {started ? (
          <AnimatedNumber
            value={stat.value}
            duration={0.8}
            format={(v) => `${Math.round(v)}${stat.suffix ?? ""}`}
          />
        ) : (
          <span>0{stat.suffix ?? ""}</span>
        )}
      </p>
      <p className="text-xs text-slate-400">{stat.label}</p>
    </motion.div>
  )
}

export function AnimatedStats() {
  const stats: StatItem[] = [
    { value: 3, suffix: " en 1", label: "POS · Panel · Portal" },
    { value: 100, suffix: "%", label: "Datos en tiempo real" },
    { value: 15, suffix: "+", label: "Sucursales + CEDIS" },
    { value: 100, suffix: "%", label: "Entregas seguras QR/PIN" },
  ]

  return (
    <div className="mx-auto grid max-w-3xl grid-cols-2 gap-4 pt-6 sm:grid-cols-4">
      {stats.map((stat, i) => (
        <StatCard key={stat.label} stat={stat} delay={i * 0.1} />
      ))}
    </div>
  )
}
