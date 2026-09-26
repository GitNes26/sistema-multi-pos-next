"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Armchair, Check, Clock, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { LiveBadge } from "@/components/shared/live-badge"
import { useSseStore } from "@/stores/sse-store"
import { cn } from "@/lib/utils"

interface Table {
  id: string
  number: number
  name: string | null
  capacity: number | null
  status: string
  room: { id: string; name: string } | null
  location: { name: string } | null
  // Aviso de llegada: reservación confirmada próxima (anfitrión prepara el lugar).
  upcomingReservation?: { guests: number; startsAt: string } | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (table: { id: string; number: number; name: string | null }) => void
  locationId?: string
}

const statusColor = (s: string) => {
  if (s === "free") return "bg-success/10 border-success/30 text-success-ink hover:bg-success/20"
  if (s === "occupied") return "bg-destructive/10 border-destructive/30 text-destructive cursor-not-allowed"
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

export function TableSelector({ open, onClose, onSelect, locationId }: Props) {
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [glowingIds, setGlowingIds] = useState<Set<string>>(new Set())
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

    // Open SSE stream for live updates.
    registerSse("tables")
    connectSse()

    return () => {
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

            {/* Mesas agrupadas por sala (el plano del local) */}
            {(() => {
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
                      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
                        {groups.get(room)!.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            disabled={t.status === "occupied"}
                            onClick={() => {
                              // Marcar mesa como ocupada en BD
                              fetch("/api/tables", {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ id: t.id, status: "occupied" }),
                              }).then((res) => {
                                if (!res.ok) console.error("[table-selector] No se pudo marcar mesa como ocupada")
                              }).catch((err) => {
                                console.error("[table-selector] Error marcando mesa:", err)
                              })
                              onSelect({ id: t.id, number: t.number, name: t.name })
                              onClose()
                            }}
                            title={t.upcomingReservation
                              ? `Mesa ${t.number} · reservación confirmada ${new Date(t.upcomingReservation.startsAt).toLocaleString("es-MX", { hour: "2-digit", minute: "2-digit" })} · ${t.upcomingReservation.guests} pers.`
                              : undefined}
                            className={cn(
                              "press relative flex min-h-28 flex-col items-center justify-center gap-1 rounded-2xl border-2 p-3 disabled:cursor-not-allowed",
                              statusColor(t.status),
                              glowingIds.has(t.id) && "animate-table-glow",
                              t.upcomingReservation && "ring-2 ring-violet-500/60 ring-offset-2 ring-offset-popover"
                            )}
                          >
                            {t.upcomingReservation && (
                              <span className="absolute -top-2.5 -right-2 flex items-center gap-1 rounded-full bg-violet-600 px-2 py-0.5 text-xs font-semibold text-white shadow-e1 tabular">
                                <Clock className="size-3" />
                                {new Date(t.upcomingReservation.startsAt).toLocaleTimeString("es-MX", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            )}
                            <Armchair className="size-5" />
                            <span className="text-xl leading-none font-bold tabular">{t.number}</span>
                            {t.name && <span className="w-full truncate text-center text-xs">{t.name}</span>}
                            {t.capacity && <span className="text-xs opacity-80 tabular">{t.capacity} pers.</span>}
                            <Badge variant="outline" className="px-1.5 py-0 text-xs">
                              {statusLabel(t.status)}
                            </Badge>
                            {t.upcomingReservation && (
                              <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                                Llega · {t.upcomingReservation.guests} pers.
                              </span>
                            )}
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
