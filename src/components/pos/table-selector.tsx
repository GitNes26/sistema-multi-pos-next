"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Armchair, Clock, LayoutGrid, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { LiveBadge } from "@/components/shared/live-badge"
import { useSseStore } from "@/stores/sse-store"
import { PlanNodeElement, PlanTableElement, type PlanNode } from "@/components/admin/tables/plan-elements"
import { cn } from "@/lib/utils"

interface Table {
  id: string
  number: number
  name: string | null
  posX?: number | null
  posY?: number | null
  width?: number | null
  height?: number | null
  shape?: string
  rotation?: number
  capacity: number | null
  status: string
  room: { id: string; name: string } | null
  location: { name: string } | null
  // Aviso de llegada: reservación confirmada próxima (anfitrión prepara el lugar).
  upcomingReservation?: { guests: number; startsAt: string } | null
  /** Avance del servicio de la cuenta abierta (cocina → mesa). */
  service?: { total: number; inKitchen: number; toServe: number; served: number; amount: number } | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (table: { id: string; number: number; name: string | null }) => void
  locationId?: string
}

const statusColor = (s: string) => {
  if (s === "free") return "bg-success/10 border-success/30 text-success-ink hover:bg-success/20"
  if (s === "occupied") return "bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20"
  if (s === "reserved") return "bg-warning/10 border-warning/30 text-warning-ink"
  return "bg-muted border-border text-foreground"
}

const statusLabel = (s: string) => {
  if (s === "free") return "Libre"
  if (s === "occupied") return "Ocupada"
  if (s === "reserved") return "Reservada"
  return s
}

const SSE_RETRIES_MAX = 5;

/** Qué le falta a la mesa: en cocina, listo para llevar o todo servido. */
function ServiceChips({ service }: { service?: Table["service"] }) {
  if (!service || service.total <= 0) return null
  const done = service.inKitchen === 0 && service.toServe === 0
  return (
    <span className="flex flex-wrap gap-1">
      {service.toServe > 0 && (
        <span className="rounded-full bg-warning/20 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-warning-ink tabular">
          Por llevar {service.toServe}
        </span>
      )}
      {service.inKitchen > 0 && (
        <span className="rounded-full bg-info/15 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-info-ink tabular">
          En cocina {service.inKitchen}
        </span>
      )}
      {done && (
        <span className="rounded-full bg-success/20 px-1.5 py-0.5 text-[11px] leading-none font-semibold text-success-ink">
          Todo servido
        </span>
      )}
    </span>
  )
}

export function TableSelector({ open, onClose, onSelect, locationId }: Props) {
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [glowingIds, setGlowingIds] = useState<Set<string>>(new Set())
  // Dos vistas: lista (rápida) y plano (para ubicarse en la sala). Se recuerda la elección.
  const [mode, setMode] = useState<"list" | "plan">(() => {
    try {
      return (localStorage.getItem("multi-pos.table-selector-mode") as "list" | "plan") || "list"
    } catch {
      return "list"
    }
  })
  const changeMode = (m: "list" | "plan") => {
    setMode(m)
    try {
      localStorage.setItem("multi-pos.table-selector-mode", m)
    } catch {
      /* sin almacenamiento */
    }
  }
  const [nodes, setNodes] = useState<PlanNode[]>([])
  const [planRoom, setPlanRoom] = useState<string>("")
  const glowTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const esRef = useRef<EventSource | null>(null)
  const retriesRef = useRef(0)
  const closedRef = useRef(false)

  // Estado SSE reportado al badge "En vivo" compartido.
  const registerSse = useSseStore((s) => s.register)
  const unregisterSse = useSseStore((s) => s.unregister)
  const setSseStatus = useSseStore((s) => s.setStatus)

  /** Mark a table as "just changed" for 2 seconds so it pulses. */
  const triggerGlow = (id: string) => {
    // Clear any existing timer for this id.
    const existing = glowTimers.current.get(id)
    if (existing) clearTimeout(existing)
    // Add to the glowing set.
    setGlowingIds((prev) => new Set(prev).add(id))
    // Remove after 2 seconds.
    const timer = setTimeout(() => {
      setGlowingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      glowTimers.current.delete(id)
    }, 2_000)
    glowTimers.current.set(id, timer)
  }

  // SSE connection for live table updates.
  const connectSse = useCallback(() => {
    if (closedRef.current) return
    const params = new URLSearchParams()
    if (locationId) params.set("locationId", locationId)
    const es = new EventSource(`/api/tables/stream?${params}`)
    esRef.current = es

    es.onopen = () => {
      retriesRef.current = 0
      setSseStatus("tables", "connected")
    }

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { tables?: Table[] } & Table
        if (Array.isArray(data.tables)) {
          // Initial snapshot from the SSE endpoint.
          setTables(data.tables)
          setLoading(false)
        } else if (data.id && data.status) {
          // Single table update broadcast — merge into the list + trigger glow.
          setTables((prev) =>
            prev.map((t) =>
              t.id === data.id
                ? {
                    ...t,
                    status: data.status,
                    name: data.name ?? t.name,
                    room: data.room ?? t.room,
                    upcomingReservation:
                      data.upcomingReservation !== undefined
                        ? data.upcomingReservation
                        : t.upcomingReservation,
                    service: data.service !== undefined ? data.service : t.service,
                  }
                : t
            )
          )
          triggerGlow(data.id)
        }
      } catch {
        // Ignore non-JSON messages.
      }
    }

    es.onerror = () => {
      es.close()
      setSseStatus("tables", "reconnecting")
      if (!closedRef.current && retriesRef.current < SSE_RETRIES_MAX) {
        retriesRef.current += 1
        const delay = Math.min(1000 * 2 ** retriesRef.current, 10_000)
        setTimeout(connectSse, delay)
      }
    }
  }, [locationId])

  useEffect(() => {
    if (!open) {
      // Close SSE when dialog closes.
      esRef.current?.close()
      esRef.current = null
      return
    }

    setLoading(true)
    closedRef.current = false
    retriesRef.current = 0

    // Fallback fetch in case the SSE initial load is slow.
    const params = new URLSearchParams()
    if (locationId) params.set("locationId", locationId)
    fetch(`/api/tables?${params}`)
      .then((r) => r.json())
      .then((d) => setTables(d.tables ?? []))
      .catch(() => setTables([]))
      .finally(() => setLoading(false))
    fetch(`/api/tables/plan-nodes?${params}`)
      .then((r) => r.json())
      .then((d) => setNodes(d.nodes ?? []))
      .catch(() => setNodes([]))

    // Open SSE stream for live updates.
    registerSse("tables")
    connectSse()
    // El avance de cocina → mesa cambia sin eventos de mesa: refresco suave.
    const poll = window.setInterval(() => {
      fetch(`/api/tables?${params}`)
        .then((r) => r.json())
        .then((d) => Array.isArray(d.tables) && setTables(d.tables))
        .catch(() => undefined)
    }, 10_000)

    return () => {
      window.clearInterval(poll)
      closedRef.current = true
      esRef.current?.close()
      esRef.current = null
      unregisterSse("tables")
      // Clean up glow timers.
      for (const timer of glowTimers.current.values()) clearTimeout(timer)
      glowTimers.current.clear()
      setGlowingIds(new Set())
    }
  }, [open, locationId, connectSse])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl" data-guide="pos-table-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Armchair className="size-5" />
            Seleccionar Mesa
            <LiveBadge sources={["tables"]} compact className="ml-auto" />
          </DialogTitle>
          <div className="flex gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="Vista de mesas">
            {([["list", "Lista", List], ["plan", "Plano", LayoutGrid]] as const).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                onClick={() => changeMode(value)}
                className={cn(
                  "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition",
                  mode === value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Cargando mesas...</div>
        ) : tables.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>No hay mesas configuradas.</p>
            <p className="text-xs mt-1">Puede ingresar el número manualmente en el ticket.</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => {
                const num = prompt("Número de mesa:")
                if (num && num.trim()) {
                  onSelect({ id: `manual-${num.trim()}`, number: parseInt(num.trim()) || 0, name: `Mesa ${num.trim()}` })
                  onClose()
                }
              }}
            >
              Ingresar número manual
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-success/20 border border-success" /> Libre</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-destructive/20 border border-destructive" /> Ocupada</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-warning/20 border border-warning" /> Reservada</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full border border-violet-400 ring-2 ring-violet-300/60" /> Llega hoy</span>
            </div>

            {mode === "plan" && (() => {
              const rooms = [...new Map(tables.map((t) => [t.room?.id ?? "", t.room?.name ?? "Sin sala"])).entries()]
              const current = rooms.some(([id]) => id === planRoom) ? planRoom : (rooms[0]?.[0] ?? "")
              const roomTables = tables.filter((t) => (t.room?.id ?? "") === current)
              const roomNodes = nodes.filter((n) => (n.roomId ?? "") === current)
              return (
                <div className="space-y-2">
                  {rooms.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      {rooms.map(([id, name]) => (
                        <button
                          key={id || "none"}
                          type="button"
                          onClick={() => setPlanRoom(id)}
                          className={cn(
                            "h-9 rounded-full border px-3 text-xs font-semibold transition",
                            current === id ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="overflow-auto rounded-xl border bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] bg-[size:24px_24px] dark:bg-[linear-gradient(to_right,#ffffff10_1px,transparent_1px),linear-gradient(to_bottom,#ffffff10_1px,transparent_1px)]" style={{ maxHeight: "55dvh" }}>
                    <div className="relative" style={{ width: 880, height: 560 }}>
                      {roomNodes.map((n) => (
                        <PlanNodeElement key={n.id} node={n} x={n.posX} y={n.posY} disabled />
                      ))}
                      {roomTables.map((t, i) => (
                        <PlanTableElement
                          key={t.id}
                          table={{ ...t, shape: t.shape ?? "round", width: t.width ?? null, height: t.height ?? null, posX: t.posX ?? null, posY: t.posY ?? null, capacity: t.capacity ?? 4 }}
                          x={t.posX ?? 70 + (i % 5) * 120}
                          y={t.posY ?? 70 + Math.floor(i / 5) * 110}
                          label={
                            t.status === "occupied" && t.service
                              ? t.service.toServe > 0
                                ? `llevar ${t.service.toServe}`
                                : t.service.inKitchen > 0
                                  ? `cocina ${t.service.inKitchen}`
                                  : "servido"
                              : t.capacity
                                ? `${t.capacity} pers.`
                                : null
                          }
                          className={cn(
                            t.status === "free" && "border-success bg-success/15 text-success-ink",
                            t.status === "occupied" && "border-destructive bg-destructive/15 text-destructive",
                            t.status === "reserved" && "border-warning bg-warning/15 text-warning-ink",
                            glowingIds.has(t.id) && "animate-table-glow"
                          )}
                          onClick={() => {
                            onSelect({ id: t.id, number: t.number, name: t.name })
                            onClose()
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Mesas agrupadas por sala (el plano del local) */}
            {mode === "list" && (() => {
              const groups = new Map<string, Table[]>()
              for (const t of tables) {
                const key = t.room?.name ?? "Sin sala"
                if (!groups.has(key)) groups.set(key, [])
                groups.get(key)!.push(t)
              }
              const order = [...groups.keys()].sort((a, b) =>
                a === "Sin sala" ? 1 : b === "Sin sala" ? -1 : a.localeCompare(b, "es")
              )
              return (
                <div className="space-y-3">
                  {order.map((room) => (
                    <div key={room}>
                      <p className="mb-2 text-sm font-semibold text-muted-foreground">
                        {room}
                      </p>
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                        {groups.get(room)!.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              // La mesa queda «ocupada» hasta que se envía algo a cocina, no al elegirla.
                              onSelect({ id: t.id, number: t.number, name: t.name })
                              onClose()
                            }}
                            className={cn(
                              "press relative flex min-h-32 min-w-0 flex-col gap-1.5 rounded-2xl border-2 p-3 text-left",
                              statusColor(t.status),
                              glowingIds.has(t.id) && "animate-table-glow",
                              t.upcomingReservation && "ring-2 ring-violet-500/60 ring-offset-2 ring-offset-popover"
                            )}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="text-2xl leading-none font-bold tabular">{t.number}</span>
                              <Armchair className="size-5 shrink-0 opacity-70" />
                            </span>
                            <span className="min-w-0">
                              {t.name && <span className="block truncate text-xs font-medium">{t.name}</span>}
                              {t.capacity && <span className="block text-xs opacity-75 tabular">{t.capacity} personas</span>}
                            </span>
                            <span className="mt-auto flex flex-col gap-1">
                              <Badge variant="outline" className="w-fit max-w-full truncate px-1.5 py-0 text-xs">
                                {statusLabel(t.status)}
                              </Badge>
                              <ServiceChips service={t.service} />
                              {t.upcomingReservation && (
                                <span className="flex items-center gap-1 text-xs font-semibold text-violet-700 dark:text-violet-300">
                                  <Clock className="size-3 shrink-0" />
                                  <span className="truncate tabular">
                                    {new Date(t.upcomingReservation.startsAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} · {t.upcomingReservation.guests} pers.
                                  </span>
                                </span>
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}

            <div className="pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  const num = prompt("Número de mesa:")
                  if (num && num.trim()) {
                    onSelect({ id: `manual-${num.trim()}`, number: parseInt(num.trim()) || 0, name: `Mesa ${num.trim()}` })
                    onClose()
                  }
                }}
              >
                + Ingresar mesa manual
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
