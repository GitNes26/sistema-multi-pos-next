"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Armchair, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Table {
  id: string
  number: number
  name: string | null
  capacity: number | null
  status: string
  location: { name: string } | null
}

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (table: { id: string; number: number; name: string | null }) => void
  locationId?: string
}

const statusColor = (s: string) => {
  if (s === "free") return "bg-green-100 border-green-300 text-green-700 hover:bg-green-200"
  if (s === "occupied") return "bg-red-100 border-red-300 text-red-700 cursor-not-allowed"
  if (s === "reserved") return "bg-amber-100 border-amber-300 text-amber-700"
  return "bg-gray-100 border-gray-300 text-gray-700"
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
            prev.map((t) => (t.id === data.id ? { ...t, status: data.status, name: data.name ?? t.name } : t))
          )
          triggerGlow(data.id)
        }
      } catch {
        // Ignore non-JSON messages.
      }
    }

    es.onerror = () => {
      es.close()
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
    connectSse()

    return () => {
      closedRef.current = true
      esRef.current?.close()
      esRef.current = null
      // Clean up glow timers.
      for (const timer of glowTimers.current.values()) clearTimeout(timer)
      glowTimers.current.clear()
      setGlowingIds(new Set())
    }
  }, [open, locationId, connectSse])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Armchair className="size-5" />
            Seleccionar Mesa
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
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-green-200 border border-green-400" /> Libre</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-200 border border-red-400" /> Ocupada</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-amber-200 border border-amber-400" /> Reservada</span>
            </div>

            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {tables.map((t) => (
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
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border-2 p-3 transition-all",
                    statusColor(t.status),
                    glowingIds.has(t.id) && "animate-table-glow"
                  )}
                >
                  <Armchair className="size-5" />
                  <span className="text-sm font-bold">{t.number}</span>
                  {t.name && <span className="text-[10px] truncate w-full text-center">{t.name}</span>}
                  {t.capacity && <span className="text-[10px]">{t.capacity} pers.</span>}
                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                    {statusLabel(t.status)}
                  </Badge>
                </button>
              ))}
            </div>

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
