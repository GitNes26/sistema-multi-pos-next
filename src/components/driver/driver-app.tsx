"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Bike,
  CircleCheckBig,
  Clock,
  ExternalLink,
  Loader2,
  LocateFixed,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  RefreshCw,
  StickyNote,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { SegmentedFilter } from "@/components/base/segmented-filter"
import { Spinner } from "@/components/base/spinner"
import { EmptyState } from "@/components/shared/empty-state"
import { BottomSheet } from "@/components/portal/bottom-sheet"
import { DeliveryTrackingMap } from "@/components/portal/delivery-tracking-map-lazy"
import { DeliveryConfirmDialog } from "@/components/admin/orders/delivery-confirm-dialog"
import { ordersApi, type OrderDetail } from "@/lib/orders/client"
import { money } from "@/lib/pos/money"
import { swalError, swalToast } from "@/lib/swal"
import { cn } from "@/lib/utils"

// Interfaz del repartidor: sus entregas (asignadas) y las disponibles. Aceptar,
// salir en camino (comparte el GPS), avisar que llegó y confirmar con PIN/QR.

interface Row {
  id: string
  orderNumber: number
  status: string
  deliveryMethod: string
  customerName: string | null
  address: string | null
  total: number
  createdAt: string
  driverEmployeeId: string | null
  driverName: string | null
  driverAccepted: boolean
}

const ACTIVE = ["ready", "in_transit", "at_destination"]
const GPS_INTERVAL_MS = 15_000
const STEPS = [
  { key: "ready", label: "Por salir" },
  { key: "in_transit", label: "En camino" },
  { key: "at_destination", label: "En domicilio" },
]

function Elapsed({ iso }: { iso: string }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  return <span className={cn("text-xs", mins >= 20 ? "font-semibold text-warning-ink" : "text-muted-foreground")}>{mins < 1 ? "ahora" : `hace ${mins} min`}</span>
}

export function DriverApp() {
  const [rows, setRows] = useState<Row[]>([])
  const [me, setMe] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"mine" | "available">("mine")
  const [openId, setOpenId] = useState<string | null>(null)
  const [detail, setDetail] = useState<OrderDetail | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ id: string; orderNumber: number } | null>(null)
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null)
  const [gps, setGps] = useState<"idle" | "active" | "denied" | "unsupported">("idle")
  const lastPost = useRef(0)
  const watch = useRef<number | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/orders?active=1&pageSize=100", { cache: "no-store" })
      const data = await res.json()
      if (data.ok) {
        setRows(data.rows ?? [])
        setMe(data.myEmployeeId ?? null)
      }
    } catch {
      /* conserva lo último */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 12_000)
    return () => clearInterval(t)
  }, [load])

  const deliveries = useMemo(() => rows.filter((r) => r.deliveryMethod === "delivery" && ACTIVE.includes(r.status)), [rows])
  const mine = deliveries.filter((r) => r.driverEmployeeId && r.driverEmployeeId === me)
  const available = deliveries.filter((r) => !r.driverEmployeeId && r.status === "ready")
  const list = tab === "mine" ? mine : available
  const transitIds = mine.filter((r) => r.status === "in_transit").map((r) => r.id)
  const transitKey = transitIds.join(",")

  // GPS del repartidor: solo mientras lleva pedidos en camino; alimenta el mapa del cliente.
  useEffect(() => {
    if (!transitKey) {
      if (watch.current != null) navigator.geolocation?.clearWatch(watch.current)
      watch.current = null
      setGps("idle")
      return
    }
    if (!navigator.geolocation) {
      setGps("unsupported")
      return
    }
    if (watch.current != null) return
    const ids = transitKey.split(",")
    watch.current = navigator.geolocation.watchPosition(
      (p) => {
        setGps("active")
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude })
        const now = Date.now()
        if (now - lastPost.current < GPS_INTERVAL_MS) return
        lastPost.current = now
        for (const id of ids) {
          fetch(`/api/portal/orders/${id}/driver-location`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: p.coords.latitude, lng: p.coords.longitude }),
          }).catch(() => undefined)
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGps("denied")
          if (watch.current != null) navigator.geolocation.clearWatch(watch.current)
          watch.current = null
        }
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 10_000 }
    )
    return () => {
      if (watch.current != null) navigator.geolocation.clearWatch(watch.current)
      watch.current = null
    }
  }, [transitKey])

  // Detalle del pedido abierto.
  useEffect(() => {
    if (!openId) {
      setDetail(null)
      return
    }
    let alive = true
    setDetail(null)
    ordersApi
      .detail(openId)
      .then((r) => alive && setDetail(r.order))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [openId, rows])

  const act = async (row: Row | OrderDetail, kind: "accept" | "start" | "arrive") => {
    setActingId(row.id)
    try {
      if (kind === "accept") {
        const res = await fetch(`/api/orders/${row.id}/driver`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "accept" }) })
        const data = await res.json()
        if (!data.ok) throw new Error(data.error)
        swalToast(`Pedido #${row.orderNumber}: la entrega es tuya`)
      } else if (kind === "start") {
        await ordersApi.startDelivery(row.id)
        swalToast(`Pedido #${row.orderNumber} en camino`)
      } else {
        await ordersApi.confirmArrival(row.id)
        swalToast("Avisaste que llegaste: pide el PIN o escanea el QR")
      }
      await load()
    } catch (err) {
      swalError("No se pudo completar", err instanceof Error ? err.message : undefined)
    } finally {
      setActingId(null)
    }
  }

  /** Botón principal según el estado y de quién es la entrega. */
  const primary = (o: { id: string; orderNumber: number; status: string; driverEmployeeId?: string | null; driverAccepted?: boolean; driver?: OrderDetail["driver"] }) => {
    const driverId = o.driverEmployeeId ?? o.driver?.employeeId ?? null
    const accepted = o.driverAccepted ?? Boolean(o.driver?.acceptedAt)
    const isMine = driverId === me
    if (o.status === "ready") {
      if (!driverId) return { label: "Tomar entrega", icon: PackageCheck, run: () => act(o as Row, "accept"), outline: true }
      if (isMine && !accepted) return { label: "Aceptar entrega", icon: PackageCheck, run: () => act(o as Row, "accept"), outline: true }
      if (isMine) return { label: "Salir en camino", icon: Bike, run: () => act(o as Row, "start") }
    }
    if (isMine && o.status === "in_transit") return { label: "Ya llegué", icon: MapPin, run: () => act(o as Row, "arrive") }
    if (isMine && o.status === "at_destination") return { label: "Confirmar entrega (PIN/QR)", icon: CircleCheckBig, run: () => setConfirm({ id: o.id, orderNumber: o.orderNumber }) }
    return null
  }

  const gpsChip =
    gps === "active" ? (
      <span className="flex items-center gap-1 text-xs font-medium text-success-ink"><LocateFixed className="size-3.5 animate-pulse" /> GPS en vivo</span>
    ) : gps === "denied" ? (
      <span className="flex items-center gap-1 text-xs font-medium text-warning-ink"><LocateFixed className="size-3.5" /> GPS sin permiso</span>
    ) : gps === "unsupported" ? (
      <span className="text-xs text-muted-foreground">GPS no disponible</span>
    ) : null

  const stepIndex = (status: string) => STEPS.findIndex((s) => s.key === status)

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Bike className="size-7 text-primary" /> Mis entregas
        </h1>
        <div className="flex items-center gap-2">
          {gpsChip}
          <Button variant="outline" size="icon" aria-label="Actualizar" onClick={() => void load()}>
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </header>

      {gps === "denied" && (
        <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning-ink">
          Activa el permiso de ubicación del navegador para que el cliente vea tu recorrido en el mapa.
        </p>
      )}

      <SegmentedFilter
        ariaLabel="Entregas"
        value={tab}
        onChange={setTab}
        options={[
          { value: "mine", label: "Mías", count: mine.length },
          { value: "available", label: "Disponibles", count: available.length, countTone: available.length ? "warning" : undefined },
        ]}
        className="w-full [&>button]:flex-1 [&>button]:justify-center"
      />

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={Bike}
          title={tab === "mine" ? "No tienes entregas" : "No hay entregas disponibles"}
          description={tab === "mine" ? "Cuando te asignen un pedido, o tomes uno de «Disponibles», aparecerá aquí." : "Los pedidos a domicilio listos para salir y sin repartidor aparecen aquí."}
        />
      ) : (
        <ul className="space-y-3">
          {list.map((r) => {
            const a = primary(r)
            const busy = actingId === r.id
            return (
              <li key={r.id} className="overflow-hidden rounded-2xl border bg-card shadow-e1">
                <button type="button" onClick={() => setOpenId(r.id)} className="block w-full space-y-1.5 p-4 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold tabular-nums">#{r.orderNumber}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{STEPS[stepIndex(r.status)]?.label}</span>
                    <Elapsed iso={r.createdAt} />
                    <span className="ml-auto text-base font-bold tabular-nums">{money(r.total)}</span>
                  </div>
                  <p className="text-sm font-medium">{r.customerName ?? "Cliente"}</p>
                  {r.address && (
                    <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="mt-0.5 size-4 shrink-0" /> <span className="line-clamp-2">{r.address}</span>
                    </p>
                  )}
                  {!r.driverAccepted && r.driverEmployeeId === me && <p className="text-xs font-semibold text-warning-ink">Te la asignaron: falta que la aceptes</p>}
                </button>
                {a && (
                  <div className="border-t p-3">
                    <Button className="h-12 w-full text-base" variant={a.outline ? "outline" : "default"} disabled={busy} onClick={() => void a.run()}>
                      {busy ? <Loader2 className="size-5 animate-spin" /> : <a.icon className="size-5" />} {a.label}
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Detalle del pedido: mapa, recorrido, cliente, artículos y cobro */}
      <BottomSheet
        open={Boolean(openId)}
        onOpenChange={(o) => !o && setOpenId(null)}
        title={detail ? `Pedido #${detail.orderNumber}` : "Pedido"}
        description={detail?.customerName ?? undefined}
        height="92dvh"
        maxHeight="92dvh"
        bodyClassName="space-y-4"
        footer={(() => {
          const a = detail ? primary(detail) : null
          return a && detail ? (
            <Button className="h-14 w-full text-base" variant={a.outline ? "outline" : "default"} disabled={actingId === detail.id} onClick={() => void a.run()}>
              {actingId === detail.id ? <Loader2 className="size-5 animate-spin" /> : <a.icon className="size-5" />} {a.label}
            </Button>
          ) : undefined
        })()}
      >
        {!detail ? (
          <div className="flex h-40 items-center justify-center"><Spinner /></div>
        ) : (
          <>
            {/* Recorrido */}
            <ol className="flex items-center gap-1.5" aria-label="Recorrido">
              {STEPS.map((s, i) => {
                const cur = stepIndex(detail.status)
                return (
                  <li key={s.key} className="flex flex-1 flex-col items-center gap-1 text-center">
                    <span className={cn("h-1.5 w-full rounded-full", i <= cur ? "bg-primary" : "bg-muted")} />
                    <span className={cn("text-xs", i === cur ? "font-semibold text-foreground" : "text-muted-foreground")}>{s.label}</span>
                  </li>
                )
              })}
            </ol>

            {detail.latitude != null && detail.longitude != null ? (
              <DeliveryTrackingMap
                driver={pos}
                destination={{ lat: detail.latitude, lng: detail.longitude }}
                origin={detail.locationLatitude != null && detail.locationLongitude != null ? { lat: detail.locationLatitude, lng: detail.locationLongitude } : null}
                height={260}
                interactive
                labels={{ destination: "Cliente", driver: "Tú", origin: detail.locationName ?? "Sucursal" }}
              />
            ) : (
              <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">El cliente no dejó coordenadas: usa la dirección para llegar.</p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" className="h-12">
                <a
                  href={
                    detail.latitude != null && detail.longitude != null
                      ? `https://www.google.com/maps/dir/?api=1&destination=${detail.latitude},${detail.longitude}&travelmode=driving`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(detail.address ?? "")}`
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  <Navigation className="size-4" /> Cómo llegar <ExternalLink className="size-3.5 opacity-60" />
                </a>
              </Button>
              {detail.customerPhone ? (
                <Button asChild variant="outline" className="h-12">
                  <a href={`tel:${detail.customerPhone}`}>
                    <Phone className="size-4" /> Llamar
                  </a>
                </Button>
              ) : (
                <Button variant="outline" className="h-12" disabled>
                  <Phone className="size-4" /> Sin teléfono
                </Button>
              )}
            </div>

            <section className="space-y-1.5 rounded-2xl border p-3 text-sm">
              <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-primary" /> <span className="font-medium">{detail.address ?? "Sin dirección"}</span></p>
              {detail.locationName && <p className="flex items-center gap-2 text-muted-foreground"><Clock className="size-4 shrink-0" /> Sale de {detail.locationName}{detail.locationPhone ? ` · ${detail.locationPhone}` : ""}</p>}
              {detail.notes && <p className="flex items-start gap-2 text-warning-ink"><StickyNote className="mt-0.5 size-4 shrink-0" /> {detail.notes}</p>}
            </section>

            <section className={cn("flex items-center justify-between gap-3 rounded-2xl border p-3", detail.isPaid ? "border-success/30 bg-success/5" : "border-warning/40 bg-warning/10")}>
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Wallet className="size-4" /> {detail.isPaid ? "Ya está pagado" : `Cobrar al entregar${detail.paymentMethod === "cash" || !detail.paymentMethod ? " (efectivo)" : ""}`}
              </span>
              <span className="text-xl font-bold tabular-nums">{detail.isPaid ? "" : money(detail.total)}</span>
            </section>

            <section>
              <h3 className="mb-1.5 text-sm font-semibold">Artículos ({detail.items.reduce((s, i) => s + i.quantity, 0)})</h3>
              <ul className="divide-y rounded-2xl border text-sm">
                {detail.items.map((i) => (
                  <li key={i.id} className="flex items-start justify-between gap-3 px-3 py-2">
                    <span className="min-w-0">
                      <span className="font-medium">{i.quantity} × {i.productName}</span>
                      {i.comment && <span className="block text-xs text-warning-ink">{i.comment}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </BottomSheet>

      {confirm && (
        <DeliveryConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          orderId={confirm.id}
          orderNumber={confirm.orderNumber}
          mode="delivery"
          onConfirmed={() => {
            setConfirm(null)
            setOpenId(null)
            void load()
          }}
        />
      )}
    </div>
  )
}
