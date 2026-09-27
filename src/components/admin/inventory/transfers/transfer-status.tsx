"use client"

import { Check, ClipboardList, PackageCheck, PackageOpen, Truck, X, type LucideIcon } from "lucide-react"
import { motion } from "framer-motion"
import { StatusPill, type StatusTone } from "@/components/base/status-pill"
import { cn } from "@/lib/utils"
import { TRANSFER_STATUS_LABELS, type TransferStatus } from "@/lib/inventory/transfers-client"

const TONES: Record<TransferStatus, StatusTone> = {
  pending: "warning",
  preparing: "info",
  in_transit: "primary",
  received: "success",
  cancelled: "neutral",
}

export function TransferStatusPill({ status, className }: { status: TransferStatus; className?: string }) {
  return (
    <StatusPill tone={TONES[status]} className={className}>
      {TRANSFER_STATUS_LABELS[status]}
    </StatusPill>
  )
}

const STEPS: { key: TransferStatus; label: string; hint: string; icon: LucideIcon }[] = [
  { key: "pending", label: "Solicitado", hint: "Se pidió la mercancía", icon: ClipboardList },
  { key: "preparing", label: "Preparación", hint: "Se junta y empaca", icon: PackageOpen },
  { key: "in_transit", label: "En camino", hint: "Salió del origen", icon: Truck },
  { key: "received", label: "Recibido", hint: "Se contó en destino", icon: PackageCheck },
]
const ORDER: TransferStatus[] = ["pending", "preparing", "in_transit", "received"]

/** Línea de etapas del traslado; `compact` para tarjetas. */
export function TransferStepper({ status, compact = false }: { status: TransferStatus; compact?: boolean }) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
        <X className="size-4" /> Traslado cancelado
      </div>
    )
  }
  const current = ORDER.indexOf(status)
  return (
    <ol className={cn("grid grid-cols-4", compact ? "gap-1" : "gap-2")} aria-label="Etapas del traslado">
      {STEPS.map((step, i) => {
        const done = i < current || status === "received"
        const active = i === current && status !== "received"
        const Icon = step.icon
        return (
          <li key={step.key} className="relative flex flex-col items-center text-center" aria-current={active ? "step" : undefined}>
            {i > 0 && (
              <span className={cn("absolute top-[calc(var(--s)/2)] right-1/2 left-[-50%] h-0.5 -translate-y-1/2 rounded bg-muted", compact ? "[--s:1.75rem]" : "[--s:2.5rem]")}>
                <motion.span
                  className="block h-full rounded bg-primary"
                  initial={false}
                  animate={{ width: i <= current ? "100%" : "0%" }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                />
              </span>
            )}
            <span
              className={cn(
                "relative z-10 grid place-items-center rounded-full border-2 transition-colors",
                compact ? "size-7" : "size-10",
                done ? "border-primary bg-primary text-primary-foreground" : active ? "border-primary bg-background text-primary" : "border-border bg-background text-muted-foreground"
              )}
            >
              {done ? <Check className={compact ? "size-3.5" : "size-5"} strokeWidth={3} /> : <Icon className={compact ? "size-3.5" : "size-5"} />}
              {active && !compact && <span className="absolute inset-0 animate-ping rounded-full border-2 border-primary/40 motion-reduce:hidden" />}
            </span>
            <span className={cn("mt-1.5 font-medium", compact ? "text-xs" : "text-sm", !done && !active && "text-muted-foreground")}>{step.label}</span>
            {!compact && <span className="hidden text-xs text-muted-foreground sm:block">{step.hint}</span>}
          </li>
        )
      })}
    </ol>
  )
}
