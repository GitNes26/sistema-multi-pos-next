"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"

// Palabra que rota dentro de un titular. El ancho se reserva con la palabra
// más larga (invisible) para que el texto alrededor no brinque.
export function RotatingWord({ words, interval = 2400 }: { words: string[]; interval?: number }) {
  const reduce = useReducedMotion()
  const [i, setI] = useState(0)

  useEffect(() => {
    if (reduce) return
    const id = window.setInterval(() => setI((n) => (n + 1) % words.length), interval)
    return () => window.clearInterval(id)
  }, [reduce, interval, words.length])

  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), "")

  return (
    <span className="relative inline-grid align-bottom">
      <span className="invisible col-start-1 row-start-1" aria-hidden>
        {longest}
      </span>
      <span className="sr-only">{words[0]}</span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={words[i]}
          aria-hidden
          initial={{ y: "0.6em", opacity: 0, filter: "blur(6px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={{ y: "-0.6em", opacity: 0, filter: "blur(6px)" }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="col-start-1 row-start-1 text-primary"
        >
          {words[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
