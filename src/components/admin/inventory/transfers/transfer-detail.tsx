"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  AlertTriangle, ArrowRight, CheckCircle2, CircleDot, ClipboardCheck, Loader2, LocateFixed, MapPin, Navigation,
  Package, PackageCheck, PackageOpen, Radio, Truck, User, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { DateTimePicker } from "@/components/base/date-time-picker"
import { QuantityStepper } from "@/components/base/quantity-stepper"
import { ThumbImage } from "@/components/base/thumb-image"
import { BackButton } from "@/components/shared/back-button"
import { DeliveryTrackingMap } from "@/components/portal/delivery-tracking-map-lazy"
import { transfersApi, type TransferDetail as Detail } from "@/lib/inventory/transfers-client"
import { swalConfirm, swalError, swalToast } from "@/lib/swal"
import { cn } from "@/lib/utils"
import { TransferStatusPill, TransferStepper } from "./transfer-status"
import { TransferFlow } from "./transfer-flow"

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : null

const ago = (iso: string) => {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `hace ${s} s`
  const m = Math.round(s / 60)
  return m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`
}

export function TransferDetailView({ id, canManage }: { id: string; canManage: boolean }) {
  const [t, setT] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setT(await transfersApi.get(id))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el traslado")
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  // En camino: el mapa y la última posición se actualizan cada 5 s.
  useEffect(() => {
    if (t?.status !== "in_transit") return
    const iv = window.setInterval(() => void load(), 5000)
    return () => window.clearInterval(iv)
  }, [t?.status, load])

  const run = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true)
    try {
      const res = await transfersApi.action(id, body)
      swalToast(res.hasDiscrepancy ? "Recibido con diferencias registradas" : ok)
      await load()
    } catch (err) {
      swalError("No se pudo completar", err instanceof Error ? err.message : undefined)
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    const inTransit = t?.status === "in_transit"
    const okay = await swalConfirm(
      "Cancelar traslado",
      inTransit ? "La mercancía regresará a las existencias del origen." : "No se moverá ninguna existencia.",
      { danger: true }
    )
    if (okay) await run({ action: "cancel" }, "Traslado cancelado")
  }

  if (error) return <p className="py-10 text-center text-muted-foreground">{error}</p>
  if (!t) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    )
  }

  const hasCoords = (p: { lat: number | null; lng: number | null }) => p.lat != null && p.lng != null
  const showMap = (t.status === "in_transit" || t.status === "received") && (hasCoords(t.from) || hasCoords(t.to) || t.lastPosition)
  const sent = t.items.reduce((s, i) => s + i.quantity, 0)
  const received = t.items.reduce((s, i) => s + (i.receivedQty ?? 0), 0)

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start gap-3">
        <BackButton fallback="/admin/inventory?tab=transfers" label="Traslados" showLabel />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-muted-foreground">Traslado {t.folio}</p>
          <h1 className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2 font-heading text-xl font-semibold tracking-tight">
            <span className="truncate">{t.from.name}</span>
            <ArrowRight className="size-5 shrink-0 text-primary" />
            <span className="truncate">{t.to.name}</span>
          </h1>
        </div>
        <TransferStatusPill status={t.status} className="text-sm" />
      </div>

      <div className="space-y-5 rounded-2xl border bg-card p-4 shadow-e1 sm:p-5">
        <TransferFlow
          status={t.status}
          from={{ name: t.from.name, type: t.from.type }}
          to={{ name: t.to.name, type: t.to.type }}
          sent={sent}
          received={t.status === "received" ? received : null}
        />
        <TransferStepper status={t.status} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          {/* Mapa */}
          {showMap && (
            <section className="overflow-hidden rounded-2xl border bg-card shadow-e1">
              <DeliveryTrackingMap
                height={320}
                interactive
                origin={hasCoords(t.from) ? { lat: t.from.lat!, lng: t.from.lng! } : null}
                destination={hasCoords(t.to) ? { lat: t.to.lat!, lng: t.to.lng! } : null}
                driver={t.status === "in_transit" && t.lastPosition ? { lat: t.lastPosition.lat, lng: t.lastPosition.lng } : null}
                trail={t.track}
                labels={{ driver: "Chofer", destination: t.to.name, origin: t.from.name }}
              />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2.5 text-sm">
                {t.status === "in_transit" ? (
                  t.lastPosition ? (
                    <span className="flex items-center gap-1.5">
                      <span className="relative flex size-2.5">
                        <span className="absolute inset-0 animate-ping rounded-full bg-success/60" />
                        <span className="relative size-2.5 rounded-full bg-success" />
                      </span>
                      En vivo · última señal {ago(t.lastPosition.at)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Radio className="size-4" /> Esperando que el chofer comparta su ubicación
                    </span>
                  )
                ) : (
                  <span className="text-muted-foreground">Recorrido registrado: {t.track.length} puntos</span>
                )}
                {!hasCoords(t.to) && <span className="text-xs text-muted-foreground">El destino no tiene coordenadas guardadas.</span>}
              </div>
            </section>
          )}

          {/* Productos */}
          <section className="rounded-2xl border bg-card shadow-e1">
            <header className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold">Mercancía</h2>
              <span className="text-sm text-muted-foreground tabular-nums">
                {t.status === "received" ? `${received} de ${sent} recibidas` : `${sent} unidades`}
              </span>
            </header>
            <ul className="divide-y">
              {t.items.map((i) => {
                const diff = i.receivedQty != null ? i.receivedQty - i.quantity : 0
                return (
                  <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                      {i.image ? <ThumbImage src={i.image} alt="" className="size-full object-cover" /> : <Package className="size-4 text-muted-foreground" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{i.productName}{i.variantName && i.variantName !== "Default" ? ` · ${i.variantName}` : ""}</p>
                      {i.receiveNote && <p className="truncate text-xs text-muted-foreground">“{i.receiveNote}”</p>}
                    </div>
                    <div className="text-right text-sm tabular-nums">
                      <p className="font-semibold">{i.quantity} {i.unit ?? "pza"}</p>
                      {i.receivedQty != null && (
                        <p className={cn("text-xs", diff < 0 ? "text-warning-ink" : "text-success-ink")}>
                          {diff < 0 ? `llegaron ${i.receivedQty} (${diff})` : "completo"}
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>

        <div className="min-w-0 space-y-5">
          {/* Acción de la etapa actual */}
          {canManage && (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={t.status} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                {t.status === "pending" && (
                  <StageCard icon={ClipboardCheck} title="Siguiente paso: preparar" text="Avisa que ya se está juntando la mercancía. Podrás marcar cada producto al cargarlo.">
                    <Button className="w-full" onClick={() => void run({ action: "prepare" }, "Traslado en preparación")} disabled={busy}>
                      <PackageOpen className="size-4" /> Empezar a preparar
                    </Button>
                  </StageCard>
                )}
                {t.status === "preparing" && (
                  <DispatchCard t={t} busy={busy} onDispatch={(body) => run({ action: "dispatch", ...body }, "¡Traslado en camino!")} />
                )}
                {t.status === "in_transit" && (
                  <div className="space-y-5">
                    <DriverMode transferId={t.id} onSent={load} />
                    <ReceiveCard t={t} busy={busy} onReceive={(body) => run({ action: "receive", ...body }, "Traslado recibido completo")} />
                  </div>
                )}
                {t.status === "received" && (
                  <StageCard
                    icon={t.hasDiscrepancy ? AlertTriangle : CheckCircle2}
                    tone={t.hasDiscrepancy ? "warning" : "success"}
                    title={t.hasDiscrepancy ? "Recibido con diferencias" : "Recibido completo"}
                    text={t.hasDiscrepancy ? `Llegaron ${received} de ${sent} unidades. Las existencias del destino suman solo lo recibido.` : "Todo llegó. Las existencias del destino ya están actualizadas."}
                  >
                    {t.receiveNotes && <p className="rounded-lg bg-muted p-3 text-sm">“{t.receiveNotes}”</p>}
                  </StageCard>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Datos del traslado */}
          <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-e1">
            <h2 className="font-semibold">Detalles</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Chofer" value={t.driverName} icon={User} />
              <Info label="Vehículo" value={t.vehicle} icon={Truck} />
              <Info label="Llegada estimada" value={when(t.expectedAt)} icon={MapPin} />
              <Info label="Origen" value={t.from.address ?? t.from.name} icon={CircleDot} />
            </dl>
            {t.notes && <p className="rounded-lg bg-muted p-3 text-sm">Notas: {t.notes}</p>}
          </section>

          {/* Historial */}
          <section className="rounded-2xl border bg-card p-4 shadow-e1">
            <h2 className="mb-3 font-semibold">Historial</h2>
            <ol className="space-y-3">
              {t.timeline.filter((e) => e.at).map((e) => (
                <li key={e.key} className="flex gap-3 text-sm">
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="font-medium">{{ requested: "Solicitado", preparing: "En preparación", dispatched: "Salió del origen", received: "Recibido en destino", cancelled: "Cancelado" }[e.key]}</p>
                    <p className="text-xs text-muted-foreground">{when(e.at)}{e.by ? ` · ${e.by}` : ""}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {canManage && t.status !== "received" && t.status !== "cancelled" && (
            <Button variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={cancel} disabled={busy}>
              <X className="size-4" /> {t.status === "in_transit" ? "Cancelar y regresar al origen" : "Cancelar traslado"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Piezas ──────────────────────────────────────────────────────────────

function Info({ label, value, icon: Icon }: { label: string; value: string | null; icon: typeof User }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-xs text-muted-foreground"><Icon className="size-3.5" />{label}</dt>
      <dd className="truncate font-medium">{value ?? "—"}</dd>
    </div>
  )
}

function StageCard({
  icon: Icon,
  title,
  text,
  tone = "primary",
  children,
}: {
  icon: typeof Truck
  title: string
  text: string
  tone?: "primary" | "success" | "warning"
  children?: React.ReactNode
}) {
  return (
    <section
      className={cn(
        "space-y-4 rounded-2xl border p-4 shadow-e1 sm:p-5",
        tone === "success" ? "border-success/30 bg-success/5" : tone === "warning" ? "border-warning/40 bg-warning/5" : "border-primary/30 bg-primary/[0.04]"
      )}
    >
      <div className="flex gap-3">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl",
            tone === "success" ? "bg-success/15 text-success-ink" : tone === "warning" ? "bg-warning/20 text-warning-ink" : "bg-primary/12 text-primary"
          )}
        >
          <Icon className="size-5" />
        </span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{text}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

/** Preparación y salida: lista de carga, ajuste de cantidades y datos del chofer. */
function DispatchCard({ t, busy, onDispatch }: { t: Detail; busy: boolean; onDispatch: (body: Record<string, unknown>) => void }) {
  const [loaded, setLoaded] = useState<Record<string, boolean>>({})
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(t.items.map((i) => [i.id, i.quantity])))
  const [driverName, setDriverName] = useState(t.driverName ?? "")
  const [vehicle, setVehicle] = useState(t.vehicle ?? "")
  const [expectedAt, setExpectedAt] = useState<Date | null>(t.expectedAt ? new Date(t.expectedAt) : null)
  const done = t.items.filter((i) => loaded[i.id]).length
  const allLoaded = done === t.items.length

  return (
    <StageCard icon={Truck} title="Cargar y despachar" text="Marca cada producto al subirlo al vehículo. Si falta algo, ajusta la cantidad que realmente sale.">
      <div className="space-y-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(done / Math.max(1, t.items.length)) * 100}%` }} />
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">{done} de {t.items.length} productos cargados</p>
        <ul className="space-y-2">
          {t.items.map((i) => (
            <li key={i.id} className={cn("flex items-center gap-3 rounded-xl border bg-background p-2.5", loaded[i.id] && "border-success/40 bg-success/5")}>
              <Checkbox
                checked={Boolean(loaded[i.id])}
                onCheckedChange={(v) => setLoaded((l) => ({ ...l, [i.id]: Boolean(v) }))}
                aria-label={`Cargado: ${i.productName}`}
                className="size-5"
              />
              <span className="min-w-0 flex-1 truncate text-sm">{i.productName}</span>
              <QuantityStepper size="sm" value={qty[i.id] ?? 0} max={i.quantity} onChange={(v) => setQty((q) => ({ ...q, [i.id]: v }))} ariaLabel={`Cantidad que sale de ${i.productName}`} />
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="driver">Chofer</Label>
          <Input id="driver" value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="¿Quién lo lleva?" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vehicle">Vehículo / placas</Label>
          <Input id="vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Ej. Camioneta ABC-123" />
        </div>
      </div>
      <DateTimePicker label="Llegada estimada" value={expectedAt} onChange={setExpectedAt} />
      <Button
        className="w-full"
        size="lg"
        disabled={busy || !allLoaded}
        onClick={() => onDispatch({ driverName, vehicle, expectedAt: expectedAt?.toISOString() ?? null, quantities: qty })}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />}
        {allLoaded ? "Despachar: la mercancía sale ahora" : `Marca los ${t.items.length - done} productos restantes`}
      </Button>
      <p className="text-xs text-muted-foreground">Al despachar se descuenta del inventario de {t.from.name}.</p>
    </StageCard>
  )
}

/** Recepción: contar lo que llegó; las diferencias se explican con una nota. */
function ReceiveCard({ t, busy, onReceive }: { t: Detail; busy: boolean; onReceive: (body: Record<string, unknown>) => void }) {
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries(t.items.map((i) => [i.id, i.quantity])))
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState("")
  const missing = t.items.reduce((s, i) => s + Math.max(0, i.quantity - (counts[i.id] ?? 0)), 0)

  return (
    <StageCard icon={PackageCheck} title="Recibir en destino" text={`Cuenta lo que llegó a ${t.to.name}. Solo lo recibido entra al inventario.`}>
      <ul className="space-y-2">
        {t.items.map((i) => {
          const c = counts[i.id] ?? 0
          const short = c < i.quantity
          return (
            <li key={i.id} className={cn("space-y-2 rounded-xl border bg-background p-2.5", short && "border-warning/50")}>
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.productName}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">Enviados: {i.quantity}</p>
                </div>
                <QuantityStepper size="sm" value={c} max={i.quantity} onChange={(v) => setCounts((x) => ({ ...x, [i.id]: v }))} ariaLabel={`Recibidos de ${i.productName}`} />
              </div>
              {short && (
                <Input
                  value={notes[i.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [i.id]: e.target.value }))}
                  placeholder={`¿Qué pasó con ${i.quantity - c}? (dañado, faltante…)`}
                  className="h-9 text-sm"
                />
              )}
            </li>
          )
        })}
      </ul>
      {missing > 0 ? (
        <p className="flex items-center gap-2 rounded-lg bg-warning/15 p-2.5 text-sm text-warning-ink">
          <AlertTriangle className="size-4 shrink-0" /> {missing === 1 ? "Falta 1 unidad; quedará registrada" : `Faltan ${missing} unidades; quedarán registradas`} como diferencia.
        </p>
      ) : (
        <p className="flex items-center gap-2 rounded-lg bg-success/10 p-2.5 text-sm text-success-ink">
          <CheckCircle2 className="size-4 shrink-0" /> Todo coincide con lo enviado.
        </p>
      )}
      <Textarea rows={2} value={general} onChange={(e) => setGeneral(e.target.value)} placeholder="Comentario general (opcional)" />
      <Button
        className="w-full"
        size="lg"
        disabled={busy}
        onClick={() =>
          onReceive({
            items: t.items.map((i) => ({ itemId: i.id, receivedQty: counts[i.id] ?? 0, note: notes[i.id] })),
            notes: general,
          })
        }
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />}
        {missing > 0 ? "Confirmar recepción con diferencias" : "Confirmar: llegó todo"}
      </Button>
    </StageCard>
  )
}

/** Modo chofer: el teléfono comparte la ubicación mientras el traslado va en camino. */
function DriverMode({ transferId, onSent }: { transferId: string; onSent: () => unknown }) {
  const [sharing, setSharing] = useState(false)
  const [state, setState] = useState<"idle" | "waiting" | "active" | "denied" | "unsupported">("idle")
  const [lastSent, setLastSent] = useState<number | null>(null)
  const watchRef = useRef<number | null>(null)
  const lastPostRef = useRef(0)
  const wakeRef = useRef<{ release: () => Promise<void> } | null>(null)

  useEffect(() => {
    if (!sharing) return
    if (!navigator.geolocation) {
      setState("unsupported")
      return
    }
    setState("waiting")
    // Mantener la pantalla encendida mientras se comparte (si el navegador lo permite).
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }
    nav.wakeLock?.request("screen").then((l) => (wakeRef.current = l)).catch(() => undefined)
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setState("active")
        const now = Date.now()
        if (now - lastPostRef.current < 8000) return
        lastPostRef.current = now
        transfersApi
          .location(transferId, { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy })
          .then(() => {
            setLastSent(Date.now())
            onSent()
          })
          .catch(() => undefined)
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState("denied")
          setSharing(false)
        }
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 5_000 }
    )
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
      void wakeRef.current?.release().catch(() => undefined)
      wakeRef.current = null
    }
  }, [sharing, transferId, onSent])

  return (
    <section className={cn("space-y-3 rounded-2xl border p-4 shadow-e1", sharing ? "border-success/40 bg-success/5" : "bg-card")}>
      <div className="flex items-start gap-3">
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", sharing ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground")}>
          <Navigation className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">¿Eres el chofer?</h2>
          <p className="text-sm text-muted-foreground">
            {state === "denied"
              ? "El permiso de ubicación fue negado. Actívalo en el navegador para compartir el recorrido."
              : state === "unsupported"
                ? "Este dispositivo no puede compartir ubicación."
                : sharing
                  ? state === "active"
                    ? `Compartiendo tu ubicación${lastSent ? ` · enviada ${ago(new Date(lastSent).toISOString())}` : ""}. Mantén esta pantalla abierta.`
                    : "Buscando señal GPS…"
                  : "Abre este traslado en tu teléfono y comparte la ubicación para que origen y destino vean el camino en vivo."}
          </p>
        </div>
      </div>
      <Button className="w-full" variant={sharing ? "outline" : "default"} onClick={() => setSharing((v) => !v)}>
        <LocateFixed className="size-4" /> {sharing ? "Dejar de compartir" : "Compartir mi ubicación"}
      </Button>
    </section>
  )
}
