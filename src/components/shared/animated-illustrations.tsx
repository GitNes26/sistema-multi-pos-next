"use client"

import { motion } from "framer-motion"
import { SPRING_GENTLE, SPRING_BOUNCE } from "@/lib/animation-tokens"

/* ─────────────────────────────────────────────────────────────
 *  Cart Empty — Shopping bag with floating items
 * ───────────────────────────────────────────────────────────── */
export function CartEmptyIllustration() {
  return (
    <motion.svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={SPRING_GENTLE}
    >
      <motion.path
        d="M30 45 L25 100 C25 105 30 108 35 108 L85 108 C90 108 95 105 95 100 L90 45 Z"
        className="text-muted-foreground/20"
        stroke="currentColor"
        strokeWidth="2"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
      <motion.path
        d="M42 45 C42 28 50 20 60 20 C70 20 78 28 78 45"
        fill="none"
        className="text-muted-foreground/30"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
      />
      <motion.g
        initial={{ y: 10, opacity: 0, rotate: -10 }}
        animate={{ y: 0, opacity: 1, rotate: 0 }}
        transition={{ ...SPRING_BOUNCE, delay: 0.5 }}
      >
        <rect x="44" y="60" width="14" height="12" rx="2" className="text-primary/20" stroke="currentColor" strokeWidth="1.5" />
        <line x1="44" y1="66" x2="58" y2="66" className="text-primary/30" strokeWidth="1" />
        <line x1="51" y1="60" x2="51" y2="72" className="text-primary/30" strokeWidth="1" />
      </motion.g>
      <motion.circle
        cx="68"
        cy="68"
        r="6"
        className="text-amber-500/20"
        stroke="currentColor"
        strokeWidth="1.5"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...SPRING_BOUNCE, delay: 0.7 }}
      />
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        <motion.circle cx="35" cy="35" r="2" className="text-primary/30" fill="currentColor" animate={{ y: [-2, 2, -2] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} />
        <motion.circle cx="85" cy="40" r="1.5" className="text-amber-500/30" fill="currentColor" animate={{ y: [2, -2, 2] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }} />
        <motion.circle cx="55" cy="30" r="1" className="text-emerald-500/30" fill="currentColor" animate={{ y: [-1, 3, -1] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />
      </motion.g>
    </motion.svg>
  )
}

/* ─────────────────────────────────────────────────────────────
 *  Orders Empty — Clipboard with dashed checkmarks
 * ───────────────────────────────────────────────────────────── */
export function OrdersEmptyIllustration() {
  return (
    <motion.svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={SPRING_GENTLE}
    >
      <motion.rect
        x="30"
        y="25"
        width="60"
        height="75"
        rx="8"
        className="text-muted-foreground/10"
        stroke="currentColor"
        strokeWidth="2"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
      <motion.rect
        x="45"
        y="18"
        width="30"
        height="14"
        rx="4"
        className="text-muted-foreground/20"
        stroke="currentColor"
        strokeWidth="2"
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...SPRING_BOUNCE, delay: 0.3 }}
      />
      <motion.g initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5, duration: 0.4 }}>
        <line x1="42" y1="48" x2="58" y2="48" className="text-muted-foreground/20" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />
        <line x1="62" y1="48" x2="78" y2="48" className="text-muted-foreground/15" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />
      </motion.g>
      <motion.g initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.65, duration: 0.4 }}>
        <line x1="42" y1="60" x2="58" y2="60" className="text-muted-foreground/20" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />
        <line x1="62" y1="60" x2="72" y2="60" className="text-muted-foreground/15" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />
      </motion.g>
      <motion.g initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8, duration: 0.4 }}>
        <line x1="42" y1="72" x2="58" y2="72" className="text-muted-foreground/20" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />
        <line x1="62" y1="72" x2="75" y2="72" className="text-muted-foreground/15" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />
      </motion.g>
      <motion.text
        x="88"
        y="40"
        fontSize="18"
        className="text-primary/30"
        fill="currentColor"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: [0, 1, 0], y: [5, 0, -5] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        ?
      </motion.text>
    </motion.svg>
  )
}

/* ─────────────────────────────────────────────────────────────
 *  Favorites Empty — Heart with sparkles
 * ───────────────────────────────────────────────────────────── */
export function FavoritesEmptyIllustration() {
  return (
    <motion.svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={SPRING_GENTLE}
    >
      <motion.path
        d="M60 95 C60 95 25 70 25 48 C25 35 35 28 45 28 C52 28 57 32 60 38 C63 32 68 28 75 28 C85 28 95 35 95 48 C95 70 60 95 60 95 Z"
        className="text-muted-foreground/10"
        stroke="currentColor"
        strokeWidth="2"
        initial={{ pathLength: 0, fillOpacity: 0 }}
        animate={{ pathLength: 1, fillOpacity: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      <motion.path
        d="M55 45 L58 55 L54 62 L60 70"
        fill="none"
        className="text-muted-foreground/30"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, delay: 0.8, ease: "easeOut" }}
      />
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
        <motion.path
          d="M30 35 L32 30 L34 35 L39 33 L34 35 L36 40 L34 35 L29 37 Z"
          className="text-pink-400/30"
          fill="currentColor"
          animate={{ scale: [0.8, 1.2, 0.8], rotate: [0, 15, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.path
          d="M82 40 L84 36 L86 40 L90 39 L86 40 L87 44 L86 40 L82 41 Z"
          className="text-amber-400/25"
          fill="currentColor"
          animate={{ scale: [1, 0.7, 1], rotate: [0, -10, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        />
        <motion.circle cx="45" cy="25" r="1.5" className="text-primary/20" fill="currentColor" animate={{ y: [-2, 2, -2] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} />
        <motion.circle cx="78" cy="30" r="1" className="text-rose-400/25" fill="currentColor" animate={{ y: [2, -3, 2] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }} />
      </motion.g>
    </motion.svg>
  )
}

/* ─────────────────────────────────────────────────────────────
 *  Lists Empty — Clipboard with checklist and plus icon
 * ───────────────────────────────────────────────────────────── */
export function ListsEmptyIllustration() {
  return (
    <motion.svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      fill="none"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={SPRING_GENTLE}
    >
      {/* Clipboard body */}
      <motion.rect
        x="32" y="20" width="56" height="80" rx="8"
        className="text-muted-foreground/10"
        stroke="currentColor" strokeWidth="2"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
      {/* Clipboard clip */}
      <motion.rect
        x="45" y="14" width="30" height="14" rx="5"
        className="text-muted-foreground/20"
        stroke="currentColor" strokeWidth="2"
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...SPRING_BOUNCE, delay: 0.3 }}
      />
      {/* Check row 1 */}
      <motion.g initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5, duration: 0.4 }}>
        <motion.path d="M44 44 L47 47 L52 40" fill="none" className="text-primary/30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.6 }} />
        <line x1="56" y1="44" x2="76" y2="44" className="text-muted-foreground/15" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />
      </motion.g>
      {/* Check row 2 */}
      <motion.g initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.65, duration: 0.4 }}>
        <motion.path d="M44 60 L47 63 L52 56" fill="none" className="text-primary/30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.8 }} />
        <line x1="56" y1="60" x2="72" y2="60" className="text-muted-foreground/15" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />
      </motion.g>
      {/* Check row 3 */}
      <motion.g initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8, duration: 0.4 }}>
        <motion.circle cx="48" cy="76" r="4" className="text-muted-foreground/20" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <line x1="56" y1="76" x2="74" y2="76" className="text-muted-foreground/15" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 3" />
      </motion.g>
      {/* Floating plus */}
      <motion.g
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...SPRING_BOUNCE, delay: 1 }}
      >
        <motion.circle cx="88" cy="88" r="12" className="text-primary/15" fill="currentColor" />
        <motion.path d="M83 88 L93 88 M88 83 L88 93" className="text-primary/40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </motion.g>
      {/* Sparkles */}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
        <motion.circle cx="28" cy="38" r="1.5" className="text-primary/20" fill="currentColor" animate={{ y: [-2, 2, -2] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} />
        <motion.circle cx="95" cy="35" r="1" className="text-amber-500/25" fill="currentColor" animate={{ y: [2, -2, 2] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }} />
        <motion.circle cx="22" cy="75" r="1" className="text-emerald-500/25" fill="currentColor" animate={{ y: [-1, 3, -1] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.7 }} />
      </motion.g>
    </motion.svg>
  )
}
