"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ChefHat,
  ChevronRight,
  CircleCheck,
  Clock,
  CreditCard,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  ReceiptText,
  RefreshCw,
  Store,
  StickyNote,
  Truck,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { portalApi } from "@/lib/portal/client"
import type { PortalOrderDetail } from "@/lib/portal/server"
import { money } from "@/lib/pos/money"
import { ORDER_STATUS_LABELS, type OrderStatusKey } from "@/lib/orders/client"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { usePortalStore } from "@/stores/portal-store"
import { cn } from "@/lib/utils"
import { haptic } from "@/lib/haptics"
import { OrderStatusLottie } from "@/components/portal/order-status-lottie"
import { BottomSheet } from "@/components/portal/bottom-sheet"
import { DeliveryConfirmPanel } from "@/components/portal/delivery-confirm-panel"
import { DeliveryTrackingMap } from "@/components/portal/delivery-tracking-map-lazy"
import { swalConfirm, swalError, swalToast } from "@/lib/swal"
import { PermissionSlider } from "@/components/shared/permission-slider"
import { usePortalPermissions } from "@/hooks/use-portal-permissions"

// Seguimiento del pedido con el lenguaje de una app de delivery: un titular
// grande con el tiempo estimado, barra de etapas por segmentos, mapa a pantalla
// completa cuando va en camino y las acciones a la mano.

type Stage = { key: string; statuses: OrderStatusKey[]; label: string; icon: LucideIcon }

const DELIVERY_STAGES: Stage[] = [
  { key: "received", statuses: ["pending", "confirmed"], label: "Recibido", icon: ReceiptText },
  { key: "kitchen", statuses: ["preparing", "ready"], label: "Preparando", icon: ChefHat },
  { key: "road", statuses: ["in_transit", "at_destination"], label: "En camino", icon: Truck },
  { key: "done", statuses: ["delivered"], label: "Entregado", icon: CircleCheck },
]
const PICKUP_STAGES: Stage[] = [
  { key: "received", statuses: ["pending", "confirmed"], label: "Recibido", icon: ReceiptText },
  { key: "kitchen", statuses: ["preparing"], label: "Preparando", icon: ChefHat },
  { key: "ready", statuses: ["ready"], label: "Listo", icon: Store },
  { key: "done", statuses: ["delivered"], label: "Recogido", icon: CircleCheck },
]

function headline(status: string, isDelivery: boolean): { title: string; subtitle: string } {
  switch (status) {
    case "pending":
      return { title: "Recibimos tu pedido", subtitle: "La sucursal lo está revisando para confirmarlo." }
    case "confirmed":
      return { title: "¡Pedido confirmado!", subtitle: "En unos momentos empezamos a prepararlo." }
    case "preparing":
      return { title: "Preparando tu pedido", subtitle: "Lo estamos armando con cuidado." }
    case "ready":
      return isDelivery
        ? { title: "Tu pedido está listo", subtitle: "En breve sale con el repartidor." }
        : { title: "¡Listo para recoger!", subtitle: "Muestra tu PIN o QR en la sucursal." }
    case "in_transit":
      return { title: "Va en camino", subtitle: "Tu repartidor se dirige a tu dirección." }
    case "at_destination":
      return { title: "¡Tu repartidor llegó!", subtitle: "Muéstrale tu PIN o QR para recibirlo." }
    case "delivered":
      return { title: isDelivery ? "¡Entregado!" : "¡Recogido!", subtitle: "Gracias por tu compra. ¡Que lo disfrutes!" }
    case "cancelled":
      return { title: "Pedido cancelado", subtitle: "No se hizo ningún cargo por este pedido." }
    default:
      return { title: ORDER_STATUS_LABELS[status as OrderStatusKey] ?? status, subtitle: "" }
  }
}

const clock = (d: Date) => d.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit" })

export function OrderTrackingClient({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [order, setOrder] = useState<PortalOrderDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number } | null>(null)
  const lastStatus = useRef<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    portalApi
      .order(orderId)
      .then((d) => setOrder(d.order))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
  }, [orderId])

  useEffect(() => {
    load()
  }, [load])

  // Vibración breve cada vez que el pedido avanza de etapa.
  useEffect(() => {
    if (!order) return
    if (lastStatus.current && lastStatus.current !== order.status) {
      if (order.status === "delivered" || order.status === "at_destination" || order.status === "ready") haptic.success()
      else haptic.medium()
    }
    lastStatus.current = order.status
  }, [order])

  // Notificaciones en contexto: se piden una sola vez, cuando el cliente ya
  // sigue un pedido activo (ahí es donde avisar "tu pedido está listo" le sirve).
  const { statuses, requestedTypes, markTypeRequested } = usePortalPermissions()
  const [notifAskOpen, setNotifAskOpen] = useState(false)
  const orderActive = !!order && order.status !== "delivered" && order.status !== "cancelled"
  useEffect(() => {
    if (!orderActive || statuses.notifications !== "prompt" || requestedTypes.has("notifications")) return
    const timer = setTimeout(() => setNotifAskOpen(true), 1500)
    return () => clearTimeout(timer)
  }, [orderActive, statuses.notifications, requestedTypes])
  const closeNotifAsk = () => {
    markTypeRequested("notifications")
    setNotifAskOpen(false)
  }

  // SSE del estado: recarga el pedido completo para mantener el historial al día.
  useEffect(() => {
    const es = new EventSource(`/api/portal/orders/${orderId}/stream`)
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as { status: string }
        setOrder((prev) => (!prev || prev.status === data.status ? prev : { ...prev, status: data.status }))
        portalApi
          .order(orderId)
          .then((d) => setOrder(d.order))
          .catch((err) => console.error("[order-tracking] SSE reload failed:", err))
      } catch {
        /* ignore */
      }
    }
    return () => es.close()
  }, [orderId])

  // SSE de la ubicación del repartidor.
  useEffect(() => {
    if (order?.status !== "in_transit" || order.deliveryMethod !== "delivery") return
    const es = new EventSource(`/api/portal/orders/${orderId}/driver-stream`)
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as { lat: number; lng: number }
        setDriverLoc({ lat: data.lat, lng: data.lng })
      } catch {
        /* ignore */
      }
    }
    return () => es.close()
  }, [orderId, order?.status, order?.deliveryMethod])

  const reorderItems = usePortalStore((s) => s.reorderItems)
  const setCartOpen = usePortalStore((s) => s.setCartOpen)
  const [reordering, setReordering] = useState(false)

  const cancel = async () => {
    const ok = await swalConfirm("Cancelar pedido", "¿Seguro que quieres cancelar este pedido?")
    if (!ok) return
    setCancelling(true)
    try {
      const res = await portalApi.cancelOrder(orderId)
      setOrder(res.order)
      swalToast("Pedido cancelado", "info")
    } catch (err) {
      swalError("No se pudo cancelar", err instanceof Error ? err.message : undefined)
    } finally {
      setCancelling(false)
    }
  }

  const handleReorder = async () => {
    setReordering(true)
    try {
      const res = await portalApi.reorder(orderId)
      if (!res.ok || !res.items?.length) {
        swalError("No se pudieron obtener los productos")
        return
      }
      const count = reorderItems(res.items)
      setCartOpen(true)
      swalToast(`${count} producto(s) agregado(s) al carrito`)
    } catch (err) {
      swalError("No se pudo reordenar", err instanceof Error ? err.message : undefined)
    } finally {
      setReordering(false)
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 p-10 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={load}>
            <RefreshCw className="size-4" /> Volver a intentar
          </Button>
          <Button variant="ghost" onClick={() => router.push("/portal/orders")}>Mis pedidos</Button>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-56 w-full rounded-3xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    )
  }

  const isCancelled = order.status === "cancelled"
  const isDelivered = order.status === "delivered"
  const isDelivery = order.deliveryMethod === "delivery"
  const isTransit = order.status === "in_transit" || order.status === "at_destination"
  const cancellable = order.status === "pending" || order.status === "confirmed"
  const calculatedTax = Math.max(0, order.total - order.subtotal + order.discount - order.deliveryFee - order.tip + order.pointsValue)
  const stages = isDelivery ? DELIVERY_STAGES : PICKUP_STAGES
  const stageIdx = Math.max(0, stages.findIndex((s) => s.statuses.includes(order.status as OrderStatusKey)))
  const { title, subtitle } = headline(order.status, isDelivery)

  // Hora estimada de llegada (a domicilio) a partir de la política de entrega.
  // Pedidos de hace más de 6 h ya no muestran estimación (sería engañosa).
  const createdMs = new Date(order.createdAt).getTime()
  const eta = isDelivery && order.estimatedMinutes && !isDelivered && !isCancelled && Date.now() - createdMs < 6 * 3600000
    ? new Date(createdMs + order.estimatedMinutes * 60000)
    : null
  const late = eta ? eta.getTime() < Date.now() : false
  const minutesLeft = eta && !late ? Math.max(1, Math.round((eta.getTime() - Date.now()) / 60000)) : null

  // Hora en que se alcanzó cada etapa (primer registro del historial).
  const stageTime = (stage: Stage) => {
    const h = order.history.find((x) => stage.statuses.includes(x.status as OrderStatusKey))
    return h ? clock(new Date(h.createdAt)) : null
  }

  const destination = order.latitude != null && order.longitude != null ? { lat: order.latitude, lng: order.longitude } : null
  const origin = order.locationLatitude != null && order.locationLongitude != null ? { lat: order.locationLatitude, lng: order.locationLongitude } : null
  const showMap = isTransit && isDelivery && Boolean(destination || origin)
  const itemCount = order.items.reduce((s, i) => s + i.quantity, 0)

  return (
    <div className="pb-8">
      {/* ── Héroe: mapa en vivo o ilustración ─────────────────────────── */}
      <div className="relative">
        {showMap ? (
          <div className="relative px-3 pt-3 pb-8">
            <DeliveryTrackingMap driver={driverLoc} destination={destination} origin={origin} height="52dvh" labels={{ destination: "Tu dirección" }} interactive />
          </div>
        ) : (
          <div
            className={cn(
              "relative flex h-60 items-center justify-center overflow-hidden",
              isCancelled ? "bg-destructive/10" : isDelivered ? "bg-success/10" : "bg-primary/10"
            )}
          >
            <div className="absolute -top-24 -right-16 size-72 rounded-full bg-background/40 blur-2xl" />
            {isCancelled ? (
              <XCircle className="size-20 text-destructive" />
            ) : (
              <motion.div className="relative" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 18 }}>
                <OrderStatusLottie status={order.status} />
              </motion.div>
            )}
            {isDelivered && <Celebration />}
          </div>
        )}
      </div>

      {/* ── Tarjeta principal que sube sobre el héroe ─────────────────── */}
      <div className="relative z-10 -mt-6 space-y-4 px-4">
        <motion.section
          layout
          className="rounded-3xl border bg-card p-5 shadow-e3"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground tabular-nums">Pedido #{order.orderNumber}</p>
              <AnimatePresence mode="wait" initial={false}>
                <motion.h1
                  key={order.status}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  aria-live="polite"
                  className="mt-0.5 font-heading text-2xl leading-tight font-semibold tracking-tight"
                >
                  {title}
                </motion.h1>
              </AnimatePresence>
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            </div>
            {minutesLeft != null && (
              <div className="shrink-0 rounded-2xl bg-primary px-3 py-2 text-center text-primary-foreground">
                <p className="text-2xl leading-none font-bold tabular-nums">{minutesLeft}</p>
                <p className="text-xs opacity-85">min</p>
              </div>
            )}
          </div>

          {eta && (
            <p className={cn("mt-3 flex items-center gap-1.5 text-sm", late && "text-warning-ink")}>
              <Clock className={cn("size-4", late ? "text-warning-ink" : "text-primary")} />
              {late ? (
                <>Está tardando un poco más de lo previsto ({clock(eta)})</>
              ) : (
                <>Llegada estimada <strong className="tabular-nums">{clock(eta)}</strong></>
              )}
            </p>
          )}

          {/* Barra de etapas por segmentos */}
          {!isCancelled && (
            <div className="mt-4">
              <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
                {stages.map((s, i) => {
                  const done = i < stageIdx || isDelivered
                  const active = i === stageIdx && !isDelivered
                  return (
                    <div key={s.key} className="relative h-1.5 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full bg-primary"
                        initial={false}
                        animate={{ width: done ? "100%" : active ? "55%" : "0%" }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                      />
                      {active && (
                        <motion.div
                          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent motion-reduce:hidden"
                          animate={{ left: ["-40%", "110%"] }}
                          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
              <ol className="mt-3 grid" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
                {stages.map((s, i) => {
                  const reached = i <= stageIdx || isDelivered
                  const Icon = s.icon
                  const time = stageTime(s)
                  return (
                    <li key={s.key} className="flex flex-col items-center gap-1 text-center" aria-current={i === stageIdx ? "step" : undefined}>
                      <span className={cn("grid size-8 place-items-center rounded-full transition-colors", reached ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground")}>
                        <Icon className="size-4" />
                      </span>
                      <span className={cn("text-xs", i === stageIdx ? "font-semibold text-foreground" : reached ? "text-foreground/80" : "text-muted-foreground")}>{s.label}</span>
                      <span className="h-4 text-xs text-muted-foreground tabular-nums">{time ?? ""}</span>
                    </li>
                  )
                })}
              </ol>
            </div>
          )}

          {showMap && (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs">
              <Navigation className="size-4 text-primary" />
              {order.driverName ? `${order.driverName} lleva tu pedido · ` : ""}{driverLoc ? "ubicación en tiempo real" : "esperando la señal del repartidor…"}
              {driverLoc && (
                <span className="relative ml-auto flex size-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-success/60" />
                  <span className="relative size-2 rounded-full bg-success" />
                </span>
              )}
            </p>
          )}
        </motion.section>

        {/* PIN / QR cuando toca entregar o recoger */}
        <AnimatePresence>
          {(order.status === "at_destination" || (order.status === "ready" && !isDelivery)) && order.deliveryPin && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
              <DeliveryConfirmPanel pin={order.deliveryPin} qrToken={order.deliveryQrToken} orderNumber={order.orderNumber} mode={isDelivery ? "delivery" : "pickup"} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Acciones rápidas */}
        <div className="grid grid-cols-2 gap-2">
          {order.locationPhone ? (
            <a
              href={`tel:${order.locationPhone}`}
              className="press flex h-14 items-center justify-center gap-2 rounded-2xl border bg-card text-sm font-medium shadow-e1"
            >
              <Phone className="size-4 text-primary" /> Llamar a sucursal
            </a>
          ) : (
            <div className="flex h-14 items-center justify-center gap-2 rounded-2xl border bg-card px-3 text-center text-xs text-muted-foreground">
              <Store className="size-4 shrink-0" /> {order.locationName ?? "Sucursal"}
            </div>
          )}
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className="press flex h-14 items-center justify-center gap-2 rounded-2xl border bg-card text-sm font-medium shadow-e1"
          >
            <ReceiptText className="size-4 text-primary" /> Ver recibo
          </button>
        </div>

        {/* Resumen del pedido */}
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="press flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-e1"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <PackageCheck className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {itemCount} {itemCount === 1 ? "producto" : "productos"} · {money(order.total)}
            </span>
            <span className="block truncate text-sm text-muted-foreground">{order.items.map((i) => i.productName).join(", ")}</span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </button>

        {/* Entrega */}
        <section className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-e1">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            {isDelivery ? <MapPin className="size-5" /> : <Store className="size-5" />}
          </span>
          <div className="min-w-0 text-sm">
            <p className="font-semibold">{isDelivery ? "Entrega a domicilio" : "Recoger en sucursal"}</p>
            <p className="text-muted-foreground">{isDelivery ? (order.address ?? "Tu dirección") : order.locationName}</p>
            {order.paymentMethod && (
              <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                <CreditCard className="size-3.5" />
                {order.paymentMethod === "cash" ? (isDelivery ? "Pagas al repartidor" : "Pagas en sucursal") : `Tarjeta •••• ${order.paymentReference ?? ""}`}
              </p>
            )}
            {order.notes && (
              <p className="mt-1 flex items-start gap-1.5 text-muted-foreground italic">
                <StickyNote className="mt-0.5 size-3.5 shrink-0" />“{order.notes}”
              </p>
            )}
          </div>
        </section>

        {(isDelivered || isCancelled) && (
          <Button className="h-14 w-full rounded-2xl text-base" onClick={handleReorder} disabled={reordering}>
            <RefreshCw className="size-5" /> {reordering ? "Agregando…" : "Volver a pedir"}
          </Button>
        )}

        {cancellable && (
          <button
            type="button"
            onClick={cancel}
            disabled={cancelling}
            className="w-full py-3 text-center text-sm font-medium text-destructive disabled:opacity-50"
          >
            {cancelling ? "Cancelando…" : "Cancelar pedido"}
          </button>
        )}
      </div>

      <BottomSheet open={detailsOpen} onOpenChange={setDetailsOpen} title={`Pedido #${order.orderNumber}`} description="Productos, cobro, entrega y seguimiento">
        <div className="space-y-5 pb-8">
          <section className="space-y-2">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-3 rounded-xl bg-muted/50 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {item.quantity}× {item.productName}
                  </p>
                  {item.variantName && item.variantName !== "Default" && <p className="text-xs text-muted-foreground">{item.variantName}</p>}
                  {item.bulkQuantityDisplay && <p className="text-xs text-muted-foreground">{item.bulkQuantityDisplay}</p>}
                  {item.comment && <p className="text-xs text-muted-foreground italic">“{item.comment}”</p>}
                </div>
                <span className="font-semibold tabular-nums">{money(item.lineTotal)}</span>
              </div>
            ))}
          </section>
          <section className="space-y-1.5 rounded-2xl border p-4 text-sm">
            <Row label="Subtotal" value={money(order.subtotal)} />
            {order.discount > 0 && <Row label="Descuento" value={`-${money(order.discount)}`} />}
            {calculatedTax > 0 && <Row label="Impuestos" value={money(calculatedTax)} />}
            {order.deliveryFee > 0 && <Row label={isDelivery ? "Envío" : "Cargo por recoger"} value={money(order.deliveryFee)} />}
            {order.tip > 0 && <Row label="Propina" value={money(order.tip)} />}
            {order.pointsValue > 0 && <Row label={`Puntos (${order.pointsRedeemed})`} value={`-${money(order.pointsValue)}`} />}
            <div className="flex justify-between border-t border-dashed pt-2 text-base font-bold tabular-nums">
              <span>Total</span>
              <span>{money(order.total)}</span>
            </div>
          </section>
          {order.history.length > 0 && (
            <section className="rounded-2xl border p-4">
              <h3 className="mb-3 font-semibold">Seguimiento</h3>
              <ol className="space-y-3">
                {order.history.map((h, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", i === order.history.length - 1 ? "bg-primary" : "bg-muted-foreground/40")} />
                    <span className="flex-1">{ORDER_STATUS_LABELS[h.status as OrderStatusKey] ?? h.status}</span>
                    <span className="text-muted-foreground tabular-nums">{clock(new Date(h.createdAt))}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </BottomSheet>

      <PermissionSlider
        type="notifications"
        open={notifAskOpen}
        onOpenChange={(open) => {
          if (!open) closeNotifAsk()
        }}
        onGranted={closeNotifAsk}
        onDenied={closeNotifAsk}
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground tabular-nums">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

/** Confeti breve al completar el pedido (sin librerías; respeta reduced-motion). */
function Celebration() {
  const pieces = Array.from({ length: 18 }, (_, i) => i)
  const colors = ["bg-primary", "bg-success", "bg-warning", "bg-info"]
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden">
      {pieces.map((i) => (
        <motion.span
          key={i}
          className={cn("absolute top-1/2 left-1/2 size-2 rounded-sm", colors[i % colors.length])}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{
            x: Math.cos((i / pieces.length) * Math.PI * 2) * (90 + (i % 3) * 30),
            y: Math.sin((i / pieces.length) * Math.PI * 2) * (70 + (i % 4) * 20) + 40,
            opacity: 0,
            rotate: 180 + i * 40,
          }}
          transition={{ duration: 1.4, ease: "easeOut", delay: 0.2 }}
        />
      ))}
    </div>
  )
}
