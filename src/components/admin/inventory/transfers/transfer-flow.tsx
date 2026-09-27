"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Check, Package, Store, Truck, Warehouse, X } from "lucide-react"
import { AnimatedNumber } from "@/components/base/animated-number"
import { cn } from "@/lib/utils"
import type { PlaceType, TransferStatus } from "@/lib/inventory/transfers-client"

// Traslado animado (como "Todas tus sucursales, un solo inventario" de la
// página principal): la caja sale del origen, recorre el camino y llega al
// destino; los contadores muestran lo que sale y lo que entra.

interface Place {
  name: string
  type: PlaceType
}

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2))

function Node({ place, label, value, tone, active }: { place: Place; label: string; value: number | null; tone: string; active: boolean }) {
  const Icon = place.type === "cedis" ? Warehouse : Store
  return (
    <div className="flex w-28 shrink-0 flex-col items-center text-center sm:w-36">
      <span className={cn("relative flex size-14 items-center justify-center rounded-2xl border bg-background shadow-e1 transition-colors", active && "border-primary/40")}>
        <Icon className="size-6 text-primary" />
        {active && <span className="absolute inset-0 animate-ping rounded-2xl border-2 border-primary/30 motion-reduce:hidden" />}
      </span>
      <span className="mt-2 line-clamp-2 text-xs font-semibold">{place.name}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
      {value != null && <AnimatedNumber value={value} format={(v) => fmt(v)} className={cn("text-lg font-bold tabular-nums", tone)} />}
    </div>
  )
}

export function TransferFlow({
  status,
  from,
  to,
  sent,
  received,
  preview = false,
}: {
  status: TransferStatus
  from: Place
  to: Place
  sent: number
  received: number | null
  /** Vista previa antes de solicitar: aún no sale nada. */
  preview?: boolean
}) {
  const reduce = useReducedMotion()
  const moving = status === "in_transit"
  const arrived = status === "received"
  const cancelled = status === "cancelled"
  const out = status === "in_transit" || arrived ? sent : 0
  const inn = arrived ? (received ?? sent) : 0

  return (
    <div className={cn("flex items-center gap-2 sm:gap-4", cancelled && "opacity-60 grayscale")}>
      <Node place={from} label={preview ? "Enviará" : out ? "Salieron" : "Origen"} value={preview ? sent : out || null} tone="text-foreground" active={status === "pending" || status === "preparing"} />
      <div className="relative h-16 flex-1">
        <div className={cn("absolute inset-x-0 top-8 border-t-2 border-dashed", moving ? "border-primary/40" : arrived ? "border-success/50" : "border-border")} />
        {arrived && <motion.div initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.9, ease: "easeOut" }} className="absolute inset-x-0 top-[31px] h-0.5 origin-left bg-success" />}
        {cancelled ? (
          <span className="absolute left-1/2 top-4 flex size-8 -translate-x-1/2 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <X className="size-4" />
          </span>
        ) : moving ? (
          <motion.span
            initial={reduce ? false : { left: "0%" }}
            animate={reduce ? { left: "calc(50% - 1.25rem)" } : { left: ["0%", "calc(100% - 2.5rem)"] }}
            transition={reduce ? undefined : { duration: 2.6, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.6 }}
            className="absolute top-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-e2"
          >
            <Truck className="size-5" />
          </motion.span>
        ) : arrived ? (
          <motion.span
            initial={reduce ? false : { left: "0%", opacity: 0 }}
            animate={{ left: "calc(100% - 2rem)", opacity: 1 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="absolute top-4 flex size-8 items-center justify-center rounded-lg bg-success text-white shadow-e2"
          >
            <Check className="size-4" />
          </motion.span>
        ) : (
          <motion.span
            animate={reduce ? undefined : { y: [0, -4, 0] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="absolute left-0 top-4 flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary"
          >
            <Package className="size-4" />
          </motion.span>
        )}
        <p className="absolute inset-x-0 top-12 mt-1 text-center text-xs text-muted-foreground">
          {cancelled ? "Cancelado" : preview ? `${fmt(sent)} u. por enviar` : moving ? `${fmt(sent)} u. en camino` : arrived ? "Entregado" : status === "preparing" ? "Empacando…" : "Por preparar"}
        </p>
      </div>
      <Node
        place={to}
        label={preview ? "Recibirá" : arrived ? "Entraron" : "Destino"}
        value={preview ? sent : arrived ? inn : null}
        tone={arrived && received != null && received < sent ? "text-warning-ink" : "text-success-ink"}
        active={moving}
      />
    </div>
  )
}

/** Versión mínima para tarjetas: puntos de origen/destino y el camión avanzando. */
export function TransferFlowMini({ status }: { status: TransferStatus }) {
  const reduce = useReducedMotion()
  if (status !== "in_transit") return null
  return (
    <div className="relative h-6" aria-hidden>
      <span className="absolute left-0 top-2 size-2 rounded-full bg-primary" />
      <span className="absolute right-0 top-2 size-2 rounded-full border-2 border-primary bg-background" />
      <div className="absolute inset-x-2 top-3 border-t-2 border-dashed border-primary/30" />
      <motion.span
        initial={reduce ? false : { left: "0%" }}
        animate={reduce ? { left: "45%" } : { left: ["0%", "calc(100% - 1.5rem)"] }}
        transition={reduce ? undefined : { duration: 3, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.4 }}
        className="absolute top-0 flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"
      >
        <Truck className="size-3.5" />
      </motion.span>
    </div>
  )
}
