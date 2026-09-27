"use client"

import { useEffect, useRef, useState } from "react"
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion"
import { Bell, Check, Clock, Package, Scale, ScanBarcode, ShoppingBag, Truck } from "lucide-react"
import { AnimatedNumber } from "@/components/base/animated-number"
import { cn } from "@/lib/utils"

// Composición del producto en uso (POS en tablet + portal en teléfono),
// construida con los tokens del sistema: se adapta al tema y al color de la
// empresa. Está "viva": los productos se escanean al ticket, el total sube y
// el pedido del portal avanza; responde al puntero con una inclinación leve.
// Con prefers-reduced-motion se muestra el estado final, quieto. Decorativa.

const PRODUCTS = [
  { name: "Frijol negro", price: "$32.00", unit: "/kg", bulk: true },
  { name: "Café de olla 1 kg", price: "$189.00" },
  { name: "Tortilla de maíz", price: "$24.00", unit: "/kg", bulk: true },
  { name: "Aceite 900 ml", price: "$46.50" },
  { name: "Azúcar estándar", price: "$28.00", unit: "/kg", bulk: true },
  { name: "Galletas surtidas", price: "$38.00" },
]

// Cada línea apunta a su producto en la rejilla (para resaltarlo al escanear).
const LINES = [
  { product: 0, qty: "1.250 kg", total: 40 },
  { product: 1, qty: "2", total: 378 },
  { product: 3, qty: "1", total: 46.5 },
]

const ORDER_STEPS = ["Confirmado", "Preparado", "En camino", "Entregado"]
const STEP_MS = 1700
const CYCLE = LINES.length + 2 // pausa con el ticket completo antes de reiniciar

const money = (v: number) => `$${v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function useDemoStep() {
  const reduce = useReducedMotion()
  const [tick, setTick] = useState(CYCLE - 1)
  useEffect(() => {
    if (reduce) return
    const id = window.setInterval(() => setTick((t) => (t + 1) % CYCLE), STEP_MS)
    return () => window.clearInterval(id)
  }, [reduce])
  return reduce ? CYCLE - 1 : tick
}

function PosTablet({ lines, className }: { lines: number; className?: string }) {
  const shown = LINES.slice(0, lines)
  const total = shown.reduce((s, l) => s + l.total, 0)
  const active = lines > 0 && lines <= LINES.length ? LINES[lines - 1].product : -1

  return (
    <div className={cn("overflow-hidden rounded-[1.4rem] border bg-background shadow-e3 ring-8 ring-foreground/[0.04]", className)}>
      <div className="flex items-center gap-2 border-b bg-sidebar px-3 py-2">
        <span className="relative flex size-2">
          <span className="absolute inset-0 animate-ping rounded-full bg-success/60 motion-reduce:hidden" />
          <span className="relative size-2 rounded-full bg-success" />
        </span>
        <span className="text-[0.7rem] font-semibold">Caja 1 · Sucursal Centro</span>
        <span className="relative ml-auto flex items-center gap-1 overflow-hidden rounded-md border bg-card px-2 py-0.5 text-[0.65rem] text-muted-foreground">
          <ScanBarcode className="size-3" /> Escanear
          <motion.span
            key={lines}
            aria-hidden
            initial={{ x: "-100%" }}
            animate={{ x: "220%" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute inset-y-0 left-0 w-1/3 bg-primary/25"
          />
        </span>
      </div>
      <div className="grid grid-cols-[1fr_9.5rem] sm:grid-cols-[1fr_11rem]">
        <div className="grid grid-cols-2 content-start gap-1.5 p-2 sm:grid-cols-3">
          {PRODUCTS.map((p, i) => (
            <motion.div
              key={p.name}
              animate={i === active ? { scale: [1, 0.94, 1] } : { scale: 1 }}
              transition={{ duration: 0.35 }}
              className={cn(
                "flex flex-col gap-1 rounded-lg border bg-card p-1.5 transition-colors duration-300",
                i === active && "border-primary ring-1 ring-primary",
                i > 3 && "max-sm:hidden"
              )}
            >
              <div className="relative flex h-9 items-center justify-center rounded-md bg-surface-sunken text-muted-foreground">
                <Package className="size-3.5" />
                {p.bulk && (
                  <span className="absolute top-1 left-1 flex items-center gap-0.5 rounded bg-foreground/85 px-1 text-[0.5rem] font-semibold text-background">
                    <Scale className="size-2" /> Granel
                  </span>
                )}
              </div>
              <span className="truncate text-[0.6rem] font-medium">{p.name}</span>
              <span className="text-[0.7rem] font-bold tabular">
                {p.price}
                {p.unit && <span className="text-[0.55rem] font-medium text-muted-foreground">{p.unit}</span>}
              </span>
            </motion.div>
          ))}
        </div>
        <div className="flex flex-col border-l bg-card">
          <p className="flex items-center justify-between border-b px-2.5 py-1.5 text-[0.65rem] font-semibold">
            Ticket
            <span className="rounded-full bg-primary/12 px-1.5 text-[0.55rem] text-primary tabular">{shown.length}</span>
          </p>
          <div className="min-h-[8.5rem] flex-1 space-y-1.5 p-2">
            <AnimatePresence initial={false}>
              {shown.map((l) => (
                <motion.div
                  key={l.product}
                  layout
                  initial={{ opacity: 0, x: -12, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="rounded-md border p-1.5">
                    <p className="truncate text-[0.6rem] font-medium">{PRODUCTS[l.product].name}</p>
                    <p className="flex justify-between text-[0.55rem] text-muted-foreground tabular">
                      <span>{l.qty}</span>
                      <span className="font-semibold text-foreground">{money(l.total)}</span>
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="space-y-1.5 border-t p-2">
            <p className="flex items-baseline justify-between text-[0.6rem]">
              <span>Total</span>
              <AnimatedNumber value={total} format={money} className="text-sm font-bold tabular" />
            </p>
            <span
              className={cn(
                "flex h-6 items-center justify-between rounded-md px-2 text-[0.6rem] font-semibold transition-colors duration-300",
                total > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              Cobrar <AnimatedNumber value={total} format={money} className="tabular" />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function PortalPhone({ step, className }: { step: number; className?: string }) {
  const current = Math.min(step, ORDER_STEPS.length - 1)
  const delivered = current === ORDER_STEPS.length - 1
  return (
    <div className={cn("w-44 overflow-hidden rounded-[1.8rem] border-[5px] border-foreground/90 bg-background shadow-e3", className)}>
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <span className="text-[0.65rem] font-semibold">Mi pedido</span>
        <ShoppingBag className="size-3 text-muted-foreground" />
      </div>
      <div className="space-y-2 px-2.5 pb-2.5">
        <div className={cn("rounded-xl p-2.5 transition-colors duration-500", delivered ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground")}>
          <p className="text-[0.55rem] opacity-85">Pedido #1042</p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={current}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="text-xs font-semibold"
            >
              {delivered ? "¡Entregado!" : ORDER_STEPS[current]}
            </motion.p>
          </AnimatePresence>
          <p className="mt-1 flex items-center gap-1 text-[0.55rem] opacity-85">
            <Clock className="size-2.5" /> {delivered ? "Gracias por tu compra" : `Llega en ${12 - current * 4} min`}
          </p>
        </div>
        <ol className="space-y-1.5">
          {ORDER_STEPS.map((label, i, arr) => {
            const done = i <= current
            return (
              <li key={label} className="relative flex items-center gap-1.5">
                {i < arr.length - 1 && (
                  <span className="absolute top-3 left-[0.3rem] h-2.5 w-px bg-border">
                    <span
                      className="block w-full bg-primary transition-[height] duration-500"
                      style={{ height: i < current ? "100%" : "0%" }}
                    />
                  </span>
                )}
                <span
                  className={cn(
                    "flex size-2.5 items-center justify-center rounded-full transition-colors duration-300",
                    done ? "bg-primary text-primary-foreground" : "border border-border bg-card"
                  )}
                >
                  {done && <Check className="size-1.5" strokeWidth={4} />}
                </span>
                <span className={cn("text-[0.6rem] transition-colors", i === current ? "font-semibold" : "text-muted-foreground")}>
                  {label}
                </span>
                {i === current && i === 2 && <Truck className="ml-auto size-3 text-primary" />}
              </li>
            )
          })}
        </ol>
        <div className="rounded-lg border bg-card p-1.5 text-[0.55rem]">
          <p className="text-muted-foreground">Tus puntos</p>
          <AnimatedNumber
            value={1180 + current * 35}
            format={(v) => `${Math.round(v).toLocaleString("es-MX")} pts`}
            className="text-xs font-bold tabular"
          />
        </div>
      </div>
    </div>
  )
}

export function ProductShot() {
  const tick = useDemoStep()
  const lines = Math.min(tick, LINES.length)
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)

  // Inclinación con el puntero (solo mouse/trackpad) + parallax al hacer scroll.
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-6, 6]), { stiffness: 120, damping: 18 })
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [5, -5]), { stiffness: 120, damping: 18 })
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] })
  const phoneY = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [30, -30])

  const onMove = (e: React.PointerEvent) => {
    if (reduce || e.pointerType !== "mouse") return
    const r = e.currentTarget.getBoundingClientRect()
    px.set((e.clientX - r.left) / r.width - 0.5)
    py.set((e.clientY - r.top) / r.height - 0.5)
  }
  const onLeave = () => {
    px.set(0)
    py.set(0)
  }

  return (
    <div
      ref={ref}
      aria-hidden
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="relative mx-auto w-full max-w-[34rem] select-none [perspective:1200px]"
    >
      <motion.div style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}>
        <PosTablet lines={lines} className="w-full" />
      </motion.div>

      <motion.div style={{ y: phoneY }} className="absolute -bottom-12 -left-10 hidden sm:block">
        <PortalPhone step={tick} />
      </motion.div>

      <AnimatePresence>
        {tick >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            className="absolute -top-5 right-3 flex items-center gap-2 rounded-xl border bg-popover px-2.5 py-1.5 shadow-e2 sm:-right-6"
          >
            <span className="flex size-6 items-center justify-center rounded-lg bg-primary/12 text-primary">
              <Bell className="size-3.5" />
            </span>
            <span className="leading-tight">
              <span className="block text-[0.6rem] font-semibold">Nuevo pedido en línea</span>
              <span className="block text-[0.55rem] text-muted-foreground">#1043 · Para recoger</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
