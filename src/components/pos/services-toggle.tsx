"use client"

import { useCallback, useState } from "react"
import { CalendarClock, Loader2 } from "lucide-react"
import { useSession } from "next-auth/react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { hasPermission } from "@/lib/auth/permissions"
import { matchesSearch } from "@/lib/search"
import { swalError } from "@/lib/swal"
import { cn } from "@/lib/utils"
import { useCatalogLive } from "@/hooks/use-catalog-live"
import { InputGroupField } from "@/components/base/input-group-field"

interface Service {
  id: string
  name: string
  category: string | null
  isAvailable: boolean
}

/**
 * Pausa o reanuda servicios (productos sin inventario) desde el POS. El cambio se refleja en
 * todas las cajas y en la tienda del portal al instante. Requiere el permiso pos.toggle_services.
 */
export function ServicesToggle({ onChanged }: { onChanged?: () => void }) {
  const { data: session } = useSession()
  const allowed = hasPermission(session, "pos.toggle_services")
  const [open, setOpen] = useState(false)
  const [services, setServices] = useState<Service[] | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [q, setQ] = useState("")

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/pos/services", { cache: "no-store", credentials: "include" })
      const data = await res.json()
      if (data.ok) setServices(data.services)
    } catch {
      /* se conserva la lista anterior */
    }
  }, [])

  // Si otra sesión cambia un servicio mientras el panel está abierto, se actualiza solo.
  useCatalogLive(() => {
    if (open) void load()
  })

  if (!allowed) return null

  const toggle = async (service: Service, isAvailable: boolean) => {
    setBusyId(service.id)
    setServices((list) => list?.map((s) => (s.id === service.id ? { ...s, isAvailable } : s)) ?? list)
    try {
      const res = await fetch("/api/pos/services", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: service.id, isAvailable }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo cambiar el servicio")
      onChanged?.()
    } catch (err) {
      setServices((list) => list?.map((s) => (s.id === service.id ? { ...s, isAvailable: !isAvailable } : s)) ?? list)
      swalError("No se pudo cambiar", err instanceof Error ? err.message : undefined)
    } finally {
      setBusyId(null)
    }
  }

  const visible = (services ?? []).filter((s) => !q.trim() || matchesSearch(`${s.name} ${s.category ?? ""}`, q))
  const paused = (services ?? []).filter((s) => !s.isAvailable).length

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) void load()
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="press flex h-11 shrink-0 touch-manipulation items-center gap-2 rounded-xl border px-3 text-sm font-medium whitespace-nowrap"
          title="Activar o desactivar servicios"
        >
          <CalendarClock className="size-4" />
          <span className="hidden lg:inline">Servicios</span>
          {paused > 0 && <span className="rounded-full bg-warning/20 px-1.5 text-xs">{paused} en pausa</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-2 p-3">
        <div>
          <p className="text-sm font-medium">Servicios</p>
          <p className="text-xs text-muted-foreground">Al pausar uno deja de poder venderse en todas las cajas y en la tienda del portal.</p>
        </div>
        {services && services.length > 6 && (
          <InputGroupField label="Buscar" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre del servicio" />
        )}
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {services === null ? (
            <div className="flex justify-center py-4">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : visible.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted-foreground">{services.length === 0 ? "No tienes servicios registrados." : "Sin resultados."}</p>
          ) : (
            visible.map((s) => (
              <label key={s.id} className={cn("flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted/60", !s.isAvailable && "text-muted-foreground")}>
                <span className="min-w-0">
                  <span className="block truncate text-sm">{s.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{s.isAvailable ? (s.category ?? "Disponible") : "En pausa"}</span>
                </span>
                <Switch checked={s.isAvailable} disabled={busyId === s.id} onCheckedChange={(v) => void toggle(s, v)} aria-label={`${s.isAvailable ? "Pausar" : "Reanudar"} ${s.name}`} />
              </label>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
