"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, LocateFixed, MapPin, Navigation, PackageCheck, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/base/spinner"
import { EmptyState } from "@/components/shared/empty-state"
import { swalError, swalToast } from "@/lib/swal"
import { cn } from "@/lib/utils"

interface Row {
  id: string
  folio: string
  status: "pending" | "preparing" | "in_transit"
  fromName: string
  toName: string
  toAddress: string | null
  toLat: number | null
  toLng: number | null
  units: number
  mine: boolean
  accepted: boolean
  driverName: string | null
  notes: string | null
  createdAt: string
}

const STATUS_LABEL: Record<Row["status"], string> = {
  pending: "Por preparar",
  preparing: "Preparando",
  in_transit: "En camino",
}
const GPS_INTERVAL_MS = 15_000

/** Traslados entre sucursales y CEDIS del chofer: aceptar, salir y compartir la ubicación. */
export function TransfersTab({ onCount }: { onCount?: (n: number) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [acting, setActing] = useState<string | null>(null)
  const [gps, setGps] = useState<"idle" | "active" | "denied">("idle")
  const watch = useRef<number | null>(null)
  const lastPost = useRef(0)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/driver/transfers", { cache: "no-store" })
      const data = await res.json()
      if (data.ok) {
        setRows(data.rows)
        onCount?.((data.rows as Row[]).filter((r) => r.mine || !r.driverName).length)
      } else setRows([])
    } catch {
      setRows((r) => r ?? [])
    }
  }, [onCount])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 12_000)
    return () => clearInterval(t)
  }, [load])

  // GPS: mientras lleva traslados en camino, reporta su posición a cada uno.
  const transitKey = (rows ?? []).filter((r) => r.mine && r.status === "in_transit").map((r) => r.id).join(",")
  useEffect(() => {
    if (!transitKey) {
      if (watch.current != null) navigator.geolocation?.clearWatch(watch.current)
      watch.current = null
      setGps("idle")
      return
    }
    if (!navigator.geolocation || watch.current != null) return
    const ids = transitKey.split(",")
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        setGps("active")
        const now = Date.now()
        if (now - lastPost.current < GPS_INTERVAL_MS) return
        lastPost.current = now
        for (const id of ids) {
          fetch("/api/driver/transfers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, action: "location", lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
          }).catch(() => undefined)
        }
      },
      (err) => err.code === err.PERMISSION_DENIED && setGps("denied"),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 10_000 }
    )
    return () => {
      if (watch.current != null) navigator.geolocation.clearWatch(watch.current)
      watch.current = null
    }
  }, [transitKey])

  const act = async (row: Row, action: "accept" | "depart") => {
    setActing(row.id)
    try {
      const res = await fetch("/api/driver/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, action }),
      })
      const data = await res.json()
      if (!res.ok || data.ok === false) throw new Error(data.error ?? "No se pudo completar")
      swalToast(action === "accept" ? `Traslado ${row.folio}: es tuyo` : `Traslado ${row.folio} en camino`)
      await load()
    } catch (err) {
      swalError("No se pudo completar", err instanceof Error ? err.message : undefined)
    } finally {
      setActing(null)
    }
  }

  if (rows === null) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (rows.length === 0) {
    return <EmptyState icon={Truck} title="No hay traslados" description="Los traslados que te asignen, o los que no tengan chofer, aparecen aquí." />
  }

  return (
    <div className="space-y-3">
      {gps === "active" && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-success-ink">
          <LocateFixed className="size-3.5 animate-pulse" /> Compartiendo tu ubicación con el traslado en camino
        </p>
      )}
      {gps === "denied" && (
        <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning-ink">Activa el permiso de ubicación para que el negocio vea tu recorrido.</p>
      )}
      <ul className="space-y-3">
        {rows.map((r) => {
          const busy = acting === r.id
          const action = !r.mine
            ? ({ label: "Tomar traslado", run: () => act(r, "accept"), outline: true } as const)
            : !r.accepted
              ? ({ label: "Aceptar traslado", run: () => act(r, "accept"), outline: true } as const)
              : r.status !== "in_transit"
                ? ({ label: "Salir con el traslado", run: () => act(r, "depart"), outline: false } as const)
                : null
          const maps = r.toLat != null && r.toLng != null ? `https://www.google.com/maps/dir/?api=1&destination=${r.toLat},${r.toLng}` : r.toAddress ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r.toAddress)}` : null
          return (
            <li key={r.id} className="overflow-hidden rounded-2xl border bg-card shadow-e1">
              <div className="space-y-1.5 p-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold tabular-nums">{r.folio}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", r.status === "in_transit" ? "bg-info/15 text-info-ink" : "bg-primary/10 text-primary")}>{STATUS_LABEL[r.status]}</span>
                  <span className="ml-auto text-sm font-semibold tabular-nums">{r.units} pzas</span>
                </div>
                <p className="flex items-center gap-1.5 text-sm">
                  <MapPin className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 truncate">{r.fromName}</span> <span className="text-muted-foreground">→</span> <b className="min-w-0 truncate">{r.toName}</b>
                </p>
                {r.toAddress && <p className="pl-5 text-xs text-muted-foreground">{r.toAddress}</p>}
                {r.mine && !r.accepted && <p className="text-xs font-semibold text-warning-ink">Te lo asignaron: falta que lo aceptes</p>}
                {r.notes && <p className="text-xs italic text-muted-foreground">“{r.notes}”</p>}
              </div>
              {(action || maps) && (
                <div className="flex gap-2 border-t p-3">
                  {action && (
                    <Button className="h-12 flex-1 text-base" variant={action.outline ? "outline" : "default"} disabled={busy} onClick={() => void action.run()}>
                      {busy ? <Loader2 className="size-5 animate-spin" /> : <PackageCheck className="size-5" />} {action.label}
                    </Button>
                  )}
                  {maps && r.mine && (
                    <Button asChild variant="outline" className="h-12 px-4">
                      <a href={maps} target="_blank" rel="noopener noreferrer" aria-label="Cómo llegar">
                        <Navigation className="size-5" />
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
