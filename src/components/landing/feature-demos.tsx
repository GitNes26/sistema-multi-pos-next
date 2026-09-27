"use client"

import { useEffect, useRef, useState } from "react"
import { animate, motion, useInView, useReducedMotion } from "framer-motion"
import { MapPin, Package, Scale, Store, Truck, Warehouse } from "lucide-react"
import { AnimatedNumber } from "@/components/base/animated-number"
import { cn } from "@/lib/utils"

// Mini demostraciones animadas para los diferenciadores de la portada. Se
// ejecutan solo cuando están a la vista y se quedan quietas con reduced-motion.

function useLoop(active: boolean, steps: number, ms: number) {
  const reduce = useReducedMotion()
  const [step, setStep] = useState(steps - 1)
  useEffect(() => {
    if (!active || reduce) return
    setStep(0)
    const id = window.setInterval(() => setStep((s) => (s + 1) % steps), ms)
    return () => window.clearInterval(id)
  }, [active, reduce, steps, ms])
  return reduce ? steps - 1 : step
}

function DemoFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div aria-hidden className={cn("relative overflow-hidden rounded-3xl border bg-card p-6 shadow-e2 select-none", className)}>
      {children}
    </div>
  )
}

/** Báscula: el peso sube y el precio se calcula en vivo. */
export function ScaleDemo() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: "-80px" })
  const reduce = useReducedMotion()
  const [weight, setWeight] = useState(1.25)
  const PRICE = 32

  useEffect(() => {
    if (!inView || reduce) return
    let stop = false
    const targets = [1.25, 0.5, 2.75, 0.875]
    let i = 0
    let controls: ReturnType<typeof animate> | undefined
    const run = () => {
      if (stop) return
      controls = animate(0, targets[i % targets.length], {
        duration: 1.4,
        ease: [0.16, 1, 0.3, 1],
        onUpdate: setWeight,
        onComplete: () => {
          i++
          window.setTimeout(run, 1400)
        },
      })
    }
    run()
    return () => {
      stop = true
      controls?.stop()
    }
  }, [inView, reduce])

  return (
    <div ref={ref}>
      <DemoFrame>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-surface-sunken">
              <Package className="size-4 text-muted-foreground" />
            </span>
            Frijol negro
          </span>
          <span className="rounded-full bg-primary/12 px-2.5 py-1 text-xs font-semibold text-primary tabular">$32.00 / kg</span>
        </div>
        <div className="mt-6 rounded-2xl bg-foreground p-5 text-background">
          <p className="flex items-center gap-1.5 text-xs opacity-70">
            <Scale className="size-3.5" /> Báscula conectada
          </p>
          <p className="mt-1 font-heading text-5xl font-semibold tracking-tight tabular">
            {weight.toFixed(3)}
            <span className="ml-1 text-xl opacity-60">kg</span>
          </p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-background/15">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(weight / 3, 1) * 100}%` }} />
          </div>
        </div>
        <div className="mt-4 flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Precio calculado</span>
          <span className="font-heading text-2xl font-semibold tabular">
            ${(weight * PRICE).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </DemoFrame>
    </div>
  )
}

/** Transferencia: una caja viaja del CEDIS a la sucursal y las existencias cambian. */
export function BranchesDemo() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: "-80px" })
  const step = useLoop(inView, 4, 1600)
  const moved = step * 12
  const reduce = useReducedMotion()

  const nodes = [
    { icon: Warehouse, name: "CEDIS", stock: 120 - moved, tone: "text-foreground" },
    { icon: Store, name: "Sucursal Centro", stock: 4 + moved, tone: moved > 0 ? "text-success-ink" : "text-warning-ink" },
  ]

  return (
    <div ref={ref}>
      <DemoFrame>
        <div className="flex items-center justify-between gap-3">
          {nodes.map((n, i) => (
            <div key={n.name} className={cn("flex w-32 flex-col items-center text-center", i === 1 && "order-3")}>
              <span className="flex size-14 items-center justify-center rounded-2xl border bg-background shadow-e1">
                <n.icon className="size-6 text-primary" />
              </span>
              <span className="mt-2 text-xs font-semibold">{n.name}</span>
              <AnimatedNumber
                value={n.stock}
                format={(v) => `${Math.round(v)} pzs`}
                className={cn("text-lg font-bold tabular transition-colors", n.tone)}
              />
            </div>
          ))}
          <div className="relative order-2 h-14 flex-1">
            <div className="absolute inset-x-0 top-7 border-t-2 border-dashed border-border" />
            <motion.span
              key={step}
              initial={reduce ? false : { left: "0%", opacity: 0 }}
              animate={{ left: "calc(100% - 2rem)", opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.3, ease: "easeInOut" }}
              className="absolute top-3 flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-e2"
            >
              <Package className="size-4" />
            </motion.span>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-between rounded-xl bg-surface-sunken px-4 py-3 text-sm">
          <span className="text-muted-foreground">Transferencia #T-208</span>
          <span className="font-semibold tabular">{moved} pzs enviadas</span>
        </div>
      </DemoFrame>
    </div>
  )
}

/** Rastreo: el repartidor avanza por la ruta y el tiempo estimado baja. */
export function TrackingDemo() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: "-80px" })
  const step = useLoop(inView, 5, 1300)
  const progress = step / 4
  const eta = Math.max(0, 12 - step * 3)

  return (
    <div ref={ref}>
      <DemoFrame className="p-0">
        <div
          className="relative h-48 bg-surface-sunken"
          style={{
            backgroundImage:
              "linear-gradient(color-mix(in oklab, var(--foreground) 6%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, var(--foreground) 6%, transparent) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        >
          <svg viewBox="0 0 300 160" preserveAspectRatio="none" className="absolute inset-0 size-full">
            <path d="M24 130 C 90 130, 90 40, 160 60 S 250 30, 276 30" fill="none" stroke="var(--border)" strokeWidth="6" strokeLinecap="round" />
            <motion.path
              d="M24 130 C 90 130, 90 40, 160 60 S 250 30, 276 30"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="6"
              strokeLinecap="round"
              initial={false}
              animate={{ pathLength: progress }}
              transition={{ duration: 1.1, ease: "easeInOut" }}
            />
          </svg>
          <span className="absolute top-[12%] right-[6%] flex size-8 items-center justify-center rounded-full bg-foreground text-background shadow-e2">
            <MapPin className="size-4" />
          </span>
          <motion.span
            initial={false}
            animate={{ left: `${8 + progress * 80}%`, top: `${78 - progress * 60}%` }}
            transition={{ duration: 1.1, ease: "easeInOut" }}
            className="absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-e3 ring-4 ring-primary/20"
          >
            <Truck className="size-4" />
          </motion.span>
        </div>
        <div className="flex items-center justify-between p-5">
          <div>
            <p className="text-xs text-muted-foreground">Pedido #1042</p>
            <p className="font-semibold">{eta === 0 ? "Llegó a tu domicilio" : "Va en camino"}</p>
          </div>
          <span className={cn("rounded-full px-3 py-1 text-sm font-semibold tabular transition-colors", eta === 0 ? "bg-success text-success-foreground" : "bg-primary/12 text-primary")}>
            {eta === 0 ? "Entregado" : `${eta} min`}
          </span>
        </div>
      </DemoFrame>
    </div>
  )
}
