"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  XCircle,
  Package,
  MapPin,
  Clock,
  CreditCard,
  StickyNote,
  History,
  CircleCheck,
  Truck,
  Navigation,
  RefreshCw,
  ReceiptText,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { portalApi } from "@/lib/portal/client"
import type { PortalOrderDetail } from "@/lib/portal/server"
import { money } from "@/lib/pos/money"
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  type OrderStatusKey,
} from "@/lib/orders/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { usePortalStore } from "@/stores/portal-store"
import { cn } from "@/lib/utils"
import { OrderStatusLottie } from "@/components/portal/order-status-lottie"
import { BottomSheet } from "@/components/portal/bottom-sheet"
import { DeliveryConfirmPanel } from "@/components/portal/delivery-confirm-panel"
import { DeliveryTrackingMap } from "@/components/portal/delivery-tracking-map-lazy"
import { swalConfirm, swalError, swalToast } from "@/lib/swal"
import { STAGGER_SLOW } from "@/lib/animation-tokens"
import { PermissionSlider } from "@/components/shared/permission-slider"
import { usePortalPermissions } from "@/hooks/use-portal-permissions"

const FLOW: OrderStatusKey[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "in_transit",
  "at_destination",
  "delivered",
]

const FLOW_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="size-3.5" />,
  confirmed: <CircleCheck className="size-3.5" />,
  preparing: <Package className="size-3.5" />,
  ready: <Package className="size-3.5" />,
  in_transit: <Truck className="size-3.5" />,
  at_destination: <MapPin className="size-3.5" />,
  delivered: <CircleCheck className="size-3.5" />,
}


const { container: stagger, item: fadeUp } = STAGGER_SLOW;

export function OrderTrackingClient({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [order, setOrder] = useState<PortalOrderDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [driverLoc, setDriverLoc] = useState<{
    lat: number
    lng: number
  } | null>(null)

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

  // SSE tracking — reload full order on status change to keep history in sync
  useEffect(() => {
    const es = new EventSource(`/api/portal/orders/${orderId}/stream`)
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as { status: string }
        setOrder((prev) => {
          if (!prev || prev.status === data.status) return prev
          return { ...prev, status: data.status }
        })
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

  // SSE driver location — real-time map updates
  useEffect(() => {
    if (order?.status !== "in_transit" || order.deliveryMethod !== "delivery")
      return
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
    const ok = await swalConfirm(
      "Cancelar pedido",
      "¿Seguro que quieres cancelar este pedido?"
    )
    if (!ok) return
    setCancelling(true)
    try {
      const res = await portalApi.cancelOrder(orderId)
      setOrder(res.order)
      swalToast("Pedido cancelado", "info")
    } catch (err) {
      swalError(
        "No se pudo cancelar",
        err instanceof Error ? err.message : undefined
      )
    } finally {
      setCancelling(false)
    }
  }

  const handleReorder = async () => {
    const ok = await swalConfirm(
      "Volver a pedir",
      "Se agregarán los productos de este pedido a tu carrito."
    )
    if (!ok) return
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
      swalError(
        "No se pudo reordenar",
        err instanceof Error ? err.message : undefined
      )
    } finally {
      setReordering(false)
    }
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 p-10 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={load}><RefreshCw className="size-4" /> Volver a intentar</Button>
          <Button variant="ghost" onClick={() => router.push("/portal/orders")}>Mis pedidos</Button>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-40 rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    )
  }

  const isCancelled = order.status === "cancelled"
  const isDelivery = order.deliveryMethod === "delivery"
  const isTransit =
    order.status === "in_transit" || order.status === "at_destination"
  const cancellable = order.status === "pending" || order.status === "confirmed";
  const calculatedTax = Math.max(0, order.total - order.subtotal + order.discount - order.deliveryFee - order.tip + order.pointsValue)

  // Filter delivery-only statuses from flow for pickup orders
  const visibleFlow = isDelivery
    ? FLOW
    : FLOW.filter((s) => s !== "in_transit" && s !== "at_destination")
  const rawIdx = visibleFlow.indexOf(order.status as OrderStatusKey)
  const visibleCurrentIdx = rawIdx >= 0 ? rawIdx : 0

  // Puntos reales para el mapa de seguimiento
  const destination =
    order.latitude != null && order.longitude != null
      ? { lat: order.latitude, lng: order.longitude }
      : null
  const origin =
    order.locationLatitude != null && order.locationLongitude != null
      ? { lat: order.locationLatitude, lng: order.locationLongitude }
      : null

  return (
    <motion.div
      className="space-y-4 p-4 pb-24"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center gap-3">
        {/* El encabezado del portal ya ofrece "volver" en subpáginas */}
        <div className="flex-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight tabular">Pedido #{order.orderNumber}</h1>
          <p className="text-xs text-muted-foreground">
            {new Date(order.createdAt).toLocaleString("es-MX", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <Badge
          className={cn(
            "text-xs",
            ORDER_STATUS_COLORS[order.status as OrderStatusKey]
          )}
        >
          {ORDER_STATUS_LABELS[order.status as OrderStatusKey]}
        </Badge>
      </motion.div>

      {/* Illustration + Progress */}
      <motion.div
        variants={fadeUp}
        className="rounded-2xl border bg-card p-5"
      >
        {isCancelled ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-3 py-4"
          >
            <XCircle className="size-12 text-destructive" />
            <p className="text-sm font-semibold text-destructive">
              Pedido cancelado
            </p>
          </motion.div>
        ) : (
          <>
            {/* Animated illustration */}
            <div className="flex justify-center py-2">
              <OrderStatusLottie status={order.status} />
            </div>

            {/* Status message */}
            <p aria-live="polite" className="mb-4 text-center text-sm font-medium text-muted-foreground">
              {order.status === "pending" &&
                "Tu pedido está esperando ser confirmado..."}
              {order.status === "confirmed" &&
                "Pedido confirmado, prepararemos tu pedido pronto"}
              {order.status === "preparing" &&
                "Estamos preparando tu pedido con cariño"}
              {order.status === "ready" &&
                isDelivery &&
                "Tu pedido está listo, pronto saldrá a domicilio"}
              {order.status === "ready" &&
                !isDelivery &&
                "Tu pedido está listo — muestra el PIN o QR en sucursal para recogerlo"}
              {order.status === "in_transit" &&
                "Tu pedido va en camino a tu dirección"}
              {order.status === "at_destination" &&
                "El repartidor llegó a tu domicilio — muestra el PIN o QR para recibir tu pedido"}
              {order.status === "delivered" &&
                "¡Pedido entregado! Esperamos que lo disfrutes"}
            </p>

            {/* Línea de tiempo vertical: legible en teléfono sin desplazar a los lados */}
            <ol className="relative" aria-label="Progreso del pedido">
              {visibleFlow.map((s, i) => {
                const done = i < visibleCurrentIdx
                const current = i === visibleCurrentIdx
                const last = i === visibleFlow.length - 1
                return (
                  <li
                    key={s}
                    aria-current={current ? "step" : undefined}
                    className="relative flex gap-3 pb-4 last:pb-0"
                  >
                    {!last && (
                      <span
                        aria-hidden
                        className={cn(
                          "absolute top-8 bottom-0 left-[0.9375rem] w-0.5 -translate-x-1/2 rounded-full transition-colors duration-500",
                          done ? "bg-primary" : "bg-border"
                        )}
                      />
                    )}
                    <span className="relative flex size-8 shrink-0 items-center justify-center">
                      {current && (
                        <span
                          aria-hidden
                          className="absolute inset-0 rounded-full bg-primary/30 motion-safe:animate-ping"
                        />
                      )}
                      <span
                        className={cn(
                          "relative flex size-8 items-center justify-center rounded-full border-2 transition-colors duration-300",
                          done || current
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground"
                        )}
                      >
                        {done ? <CircleCheck className="size-4" /> : FLOW_ICONS[s]}
                      </span>
                    </span>
                    <span className="flex min-h-8 items-center">
                      <span
                        className={cn(
                          "text-sm",
                          current ? "font-semibold text-foreground" : done ? "text-foreground/80" : "text-muted-foreground"
                        )}
                      >
                        {ORDER_STATUS_LABELS[s]}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ol>
          </>
        )}
      </motion.div>

      {/* Delivery confirmation — PIN + QR (domicilio en destino o recogida en sucursal) */}
      <AnimatePresence>
        {(order.status === "at_destination" ||
          (order.status === "ready" && !isDelivery)) &&
          order.deliveryPin && (
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              exit={{ opacity: 0, height: 0 }}
            >
              <DeliveryConfirmPanel
                pin={order.deliveryPin}
                qrToken={order.deliveryQrToken}
                orderNumber={order.orderNumber}
                mode={isDelivery ? "delivery" : "pickup"}
              />
            </motion.div>
          )}
      </AnimatePresence>

      {/* Delivery map — real-time driver location */}
      <AnimatePresence>
        {isTransit && isDelivery && (destination || origin) && (
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-2xl border bg-card"
          >
            <DeliveryTrackingMap
              driver={driverLoc}
              destination={destination}
              origin={origin}
              height={360}
            />
            {/* Overlay */}
            <div className="border-t p-3">
              <div className="flex items-center gap-2">
                <Navigation className="size-4 text-primary" />
                <span className="text-xs font-medium">
                  {driverLoc
                    ? "Repartidor en camino — ubicación en tiempo real"
                    : "Tu repartidor va en camino"}
                </span>
                {driverLoc && (
                  <span className="ml-auto flex size-2 rounded-full bg-success">
                    <span className="size-2 animate-ping rounded-full bg-success" />
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Productos */}
      <motion.div variants={fadeUp}>
        <Button variant="outline" className="h-12 w-full rounded-2xl" onClick={() => setDetailsOpen(true)}>
          <ReceiptText className="size-4" /> Ver toda la información del pedido
        </Button>
      </motion.div>

      {/* Productos */}
      <motion.section
        variants={fadeUp}
        className="rounded-2xl border bg-card p-4"
      >
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Package className="size-4 text-primary" /> Productos
        </h2>
        <div className="space-y-2">
          {order.items.map((it) => (
            <div key={it.id} className="flex justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {it.quantity}× {it.productName}
                  {it.variantName ? ` (${it.variantName})` : ""}
                </p>
                {it.bulkQuantityDisplay && (
                  <p className="text-xs text-muted-foreground">
                    {it.bulkQuantityDisplay}
                  </p>
                )}
                {it.comment && (
                  <p className="text-xs italic text-muted-foreground">
                    &quot;{it.comment}&quot;
                  </p>
                )}
              </div>
              <span className="shrink-0 font-medium tabular-nums">
                {money(it.lineTotal)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-1 border-t pt-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{money(order.subtotal)}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Descuento</span>
              <span>-{money(order.discount)}</span>
            </div>
          )}
          {calculatedTax > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Impuestos</span><span>{money(calculatedTax)}</span>
            </div>
          )}
          {order.deliveryFee > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>{isDelivery ? "Envío" : "Cargo por recoger"}</span><span>{money(order.deliveryFee)}</span>
            </div>
          )}
          {order.tip > 0 && (
            <div className="flex justify-between text-muted-foreground"><span>Propina</span><span>{money(order.tip)}</span></div>
          )}
          {order.pointsValue > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Puntos ({order.pointsRedeemed})</span><span>-{money(order.pointsValue)}</span>
            </div>
          )}
          <div className="flex items-baseline justify-between border-t border-dashed pt-2 text-base font-bold tabular">
            <span>Total</span>
            <span>{money(order.total)}</span>
          </div>
        </div>
      </motion.section>

      {/* Entrega */}
      <motion.section
        variants={fadeUp}
        className="rounded-2xl border bg-card p-4"
      >
        <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
          <MapPin className="size-4 text-primary" /> Entrega
        </h2>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            {isDelivery ? "A domicilio" : "Recoger en sucursal"}
          </p>
          {order.locationName && <p>{order.locationName}</p>}
          {order.address && <p>{order.address}</p>}
          {order.paymentMethod && (
            <p className="flex items-center gap-1.5">
              <CreditCard className="size-3.5" />
              {order.paymentMethod === "cash"
                ? isDelivery ? "Pago al repartidor" : "Pago en sucursal"
                : `Tarjeta •••• ${order.paymentReference ?? ""}`}
            </p>
          )}
          {order.notes && (
            <p className="flex items-start gap-1.5 italic">
              <StickyNote className="mt-0.5 size-3.5 shrink-0" />
              &quot;{order.notes}&quot;
            </p>
          )}
        </div>
      </motion.section>

      {/* Historial */}
      {order.history.length > 0 && (
        <motion.section
          variants={fadeUp}
          className="rounded-2xl border bg-card p-4"
        >
          <h2 className="mb-2 flex items-center gap-2 text-base font-semibold">
            <History className="size-4 text-primary" /> Historial
          </h2>
          <div className="space-y-1.5">
            {order.history.map((h, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs text-muted-foreground"
              >
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                  {ORDER_STATUS_LABELS[h.status as OrderStatusKey] ?? h.status}
                </span>
                <span className="tabular-nums">
                  {new Date(h.createdAt).toLocaleString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Reorder — visible for delivered or cancelled orders */}
      {(order.status === "delivered" || order.status === "cancelled") && (
        <motion.div variants={fadeUp}>
          <Button
            variant="outline"
            className="h-12 w-full rounded-2xl font-bold border-primary/30 text-primary hover:bg-primary/5"
            onClick={handleReorder}
            disabled={reordering}
          >
            <RefreshCw className="mr-2 size-4" />
            {reordering ? "Agregando…" : "Volver a pedir"}
          </Button>
        </motion.div>
      )}

      {/* Cancelar */}
      {cancellable && (
        <div className="sticky bottom-0 -mx-4 bg-background px-4 pt-3 pb-4">
          <Button
            variant="destructive"
            className="h-12 w-full rounded-2xl font-bold"
            onClick={cancel}
            disabled={cancelling}
          >
            <XCircle className="mr-2 size-4" /> Cancelar pedido
          </Button>
        </div>
      )}

      <BottomSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        title={`Pedido #${order.orderNumber}`}
        description="Productos, cobro, entrega y notas en un solo lugar"
      >
        <div className="space-y-5 pb-8">
          <section className="space-y-3">
            <h3 className="font-semibold">Productos</h3>
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-3 rounded-xl bg-muted/50 p-3 text-sm">
                <div><p className="font-medium">{item.quantity}× {item.productName}</p>{item.variantName && item.variantName !== "Default" && <p className="text-xs text-muted-foreground">{item.variantName}</p>}</div>
                <span className="font-semibold tabular-nums">{money(item.lineTotal)}</span>
              </div>
            ))}
          </section>
          <section className="space-y-2 rounded-2xl border p-4 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
            {order.discount > 0 && <div className="flex justify-between"><span>Descuento</span><span>-{money(order.discount)}</span></div>}
            {order.deliveryFee > 0 && <div className="flex justify-between"><span>Envío</span><span>{money(order.deliveryFee)}</span></div>}
            {order.tip > 0 && <div className="flex justify-between"><span>Propina</span><span>{money(order.tip)}</span></div>}
            <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>{money(order.total)}</span></div>
          </section>
          <section className="rounded-2xl border p-4 text-sm">
            <h3 className="mb-2 font-semibold">{isDelivery ? "Entrega a domicilio" : "Recoger en sucursal"}</h3>
            {order.locationName && <p>{order.locationName}</p>}
            {order.address && <p className="text-muted-foreground">{order.address}</p>}
            {order.notes && <p className="mt-2 rounded-lg bg-muted p-2 text-muted-foreground">{order.notes}</p>}
          </section>
        </div>
      </BottomSheet>

      <PermissionSlider
        type="notifications"
        open={notifAskOpen}
        onOpenChange={(open) => { if (!open) closeNotifAsk() }}
        onGranted={closeNotifAsk}
        onDenied={closeNotifAsk}
      />
    </motion.div>
  )
}
