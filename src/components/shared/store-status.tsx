"use client"

import { useCallback, useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CalendarClock, Clock, Loader2, Lock, Megaphone, Store, Unlock } from "lucide-react"
import { useSession } from "next-auth/react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { hasPermission } from "@/lib/auth/permissions"
import { swalError, swalToast } from "@/lib/swal"
import { cn } from "@/lib/utils"
import type { CloseMode, StoreStatus } from "@/lib/store-status"

// Abierto/Cerrado del negocio: switch con opciones de reapertura (panel y POS)
// y badge + aviso visibles todo el tiempo en el portal del cliente.

type CloseOptions = { timezone: string; nextBusinessDay: string; tomorrow: string }

/** Estado del negocio con actualización periódica (y al volver a la pestaña). */
export function useStoreStatus(pollMs = 60_000, withOptions = false) {
  const [status, setStatus] = useState<StoreStatus | null>(null)
  const [options, setOptions] = useState<CloseOptions | null>(null)
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/store-status${withOptions ? "?options=1" : ""}`, { credentials: "include" })
      if (!res.ok) return
      const data = await res.json()
      setStatus(data.status)
      if (data.options) setOptions(data.options)
    } catch {
      /* sin red: se conserva el último estado */
    }
  }, [withOptions])
  useEffect(() => {
    void load()
    const t = setInterval(load, pollMs)
    const onFocus = () => void load()
    window.addEventListener("focus", onFocus)
    return () => {
      clearInterval(t)
      window.removeEventListener("focus", onFocus)
    }
  }, [load, pollMs])
  return { status, options, reload: load, setStatus }
}

const fmt = (iso: string, timezone?: string) =>
  new Date(iso).toLocaleString("es-MX", { timeZone: timezone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })

function Dot({ open }: { open: boolean }) {
  return (
    <span aria-hidden className="relative flex size-2">
      {open && <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />}
      <span className={cn("relative size-2 rounded-full", open ? "bg-success" : "bg-destructive")} />
    </span>
  )
}

/** Switch del encabezado (panel y POS). */
export function StoreStatusSwitch({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { data: session } = useSession()
  const canManage = hasPermission(session, "orders.manage")
  const { status, options, setStatus } = useStoreStatus(60_000, canManage)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<CloseMode>("next_business_day")
  const [until, setUntil] = useState("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)

  if (!status) return null
  const manual = status.source === "manual"

  const send = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true)
    try {
      const res = await fetch("/api/store-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo actualizar")
      setStatus(data.status)
      swalToast(ok)
      setOpen(false)
    } catch (err) {
      swalError("No se pudo actualizar", err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  const choices: { value: CloseMode; label: string; hint: string }[] = [
    { value: "next_business_day", label: "Hasta el siguiente día hábil", hint: options ? `Reabre ${fmt(options.nextBusinessDay, options.timezone)} según tu horario` : "Según tu horario" },
    { value: "tomorrow", label: "Hasta mañana", hint: options ? `Reabre ${fmt(options.tomorrow, options.timezone)}` : "Mañana a la hora de apertura" },
    { value: "until", label: "Hasta una fecha y hora", hint: "Tú eliges cuándo reabre" },
    { value: "manual", label: "Hasta abrir manualmente", hint: "Queda cerrado hasta que lo actives" },
  ]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "press flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-semibold whitespace-nowrap transition-colors",
            status.open ? "border-success/30 bg-success/10 text-success-ink" : "border-destructive/40 bg-destructive/10 text-destructive",
            className
          )}
          title={status.label}
        >
          <Dot open={status.open} />
          {status.open ? "Abierto" : "Cerrado"}
          {!compact && !["Abierto", "Cerrado"].includes(status.label) && (
            <span className="hidden font-normal opacity-80 xl:inline">· {status.label.replace(/^Cerrado · /, "")}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 space-y-3">
        <div className="flex items-start gap-3">
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", status.open ? "bg-success/15 text-success-ink" : "bg-destructive/10 text-destructive")}>
            {status.open ? <Store className="size-5" /> : <Lock className="size-5" />}
          </span>
          <div className="min-w-0">
            <p className="font-semibold">{status.open ? "El negocio está abierto" : manual ? "Cerrado temporalmente" : "Cerrado por horario"}</p>
            <p className="text-xs text-muted-foreground">{status.label}</p>
            {manual && status.closedAt && <p className="text-xs text-muted-foreground">Desde {fmt(status.closedAt, status.timezone)}</p>}
          </div>
        </div>

        {manual && status.reason && (
          <p className="flex gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs">
            <Megaphone className="mt-0.5 size-3.5 shrink-0" /> {status.reason}
          </p>
        )}

        {!canManage ? (
          <p className="text-xs text-muted-foreground">Solo quien gestiona pedidos puede abrir o cerrar el negocio.</p>
        ) : manual ? (
          <Button className="w-full" onClick={() => void send({ action: "open" }, "Negocio abierto")} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Unlock className="size-4" />} Abrir ahora
          </Button>
        ) : (
          <div className="space-y-3 border-t pt-3">
            <p className="text-sm font-semibold">Cerrar por un imprevisto</p>
            <div role="radiogroup" className="space-y-1.5">
              {choices.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={mode === c.value}
                  onClick={() => setMode(c.value)}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors",
                    mode === c.value ? "border-primary bg-primary/5" : "hover:bg-muted/60"
                  )}
                >
                  <span className={cn("mt-1 grid size-3.5 shrink-0 place-items-center rounded-full border-2", mode === c.value ? "border-primary" : "border-muted-foreground/40")}>
                    {mode === c.value && <span className="size-1.5 rounded-full bg-primary" />}
                  </span>
                  <span>
                    <span className="block text-sm font-medium">
                      {c.label}
                      {c.value === "next_business_day" && <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 text-xs text-primary">recomendado</span>}
                    </span>
                    <span className="block text-xs text-muted-foreground">{c.hint}</span>
                  </span>
                </button>
              ))}
            </div>
            {mode === "until" && (
              <label className="block space-y-1 text-xs font-medium">
                <span className="flex items-center gap-1.5">
                  <CalendarClock className="size-3.5" /> Reabre el
                </span>
                <Input type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} />
              </label>
            )}
            <label className="block space-y-1 text-xs font-medium">
              Aviso para tus clientes (opcional)
              <Textarea rows={2} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Cerramos hoy por mantenimiento. Mañana te esperamos." />
            </label>
            <Button
              variant="destructive"
              className="w-full"
              disabled={busy || (mode === "until" && !until)}
              onClick={() => void send({ action: "close", mode, until: mode === "until" && until ? new Date(until).toISOString() : null, reason }, "Negocio cerrado · el portal ya muestra el aviso")}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />} Cerrar negocio
            </Button>
            <p className="text-xs text-muted-foreground">Mientras esté cerrado, el portal lo anuncia y no recibe pedidos.</p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

/** Badge del portal: siempre visible en el encabezado. */
export function StoreStatusBadge({ status }: { status: StoreStatus | null }) {
  if (!status) return null
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold",
        status.open ? "bg-success/12 text-success-ink" : "bg-destructive/10 text-destructive"
      )}
      title={status.label}
    >
      <Dot open={status.open} />
      {status.open ? "Abierto" : "Cerrado"}
    </span>
  )
}

/** Aviso del portal cuando el negocio está cerrado. */
export function StoreClosedBanner({ status }: { status: StoreStatus | null }) {
  const show = !!status && !status.open
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
          role="status"
        >
          <div
            className={cn(
              "mx-4 mt-3 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
              status!.source === "manual" ? "border-destructive/30 bg-destructive/10" : "border-warning/40 bg-warning/10"
            )}
          >
            {status!.source === "manual" ? <Megaphone className="mt-0.5 size-4 shrink-0 text-destructive" /> : <Clock className="mt-0.5 size-4 shrink-0 text-warning-ink" />}
            <div className="min-w-0">
              <p className="font-semibold">{status!.source === "manual" ? "Cerrado temporalmente" : "Estamos cerrados"}</p>
              {status!.reason && <p>{status!.reason}</p>}
              <p className="text-xs text-muted-foreground">
                {status!.reopensAt ? `Volvemos ${fmt(status!.reopensAt, status!.timezone)}. ` : ""}
                {status!.acceptsOrders
                  ? "Puedes hacer tu pedido ahora y lo preparamos en cuanto abramos."
                  : "Por ahora no recibimos pedidos; puedes ver el catálogo."}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
