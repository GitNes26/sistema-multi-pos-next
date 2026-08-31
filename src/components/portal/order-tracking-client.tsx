"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
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
import { swalConfirm, swalError, swalToast } from "@/lib/swal"
import { cn } from "@/lib/utils"
import { StepIllustration } from "@/components/shared/step-illustration"
import { DeliveryConfirmPanel } from "@/components/portal/delivery-confirm-panel"

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


const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

export function OrderTrackingClient({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [order, setOrder] = useState<PortalOrderDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [driverLoc, setDriverLoc] = useState<{
    lat: number
    lng: number
  } | null>(null)

  const load = useCallback(() => {
    portalApi
      .order(orderId)
      .then((d) => setOrder(d.order))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
  }, [orderId])

  useEffect(() => {
    load()
  }, [load])

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
          .catch(() => {})
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

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 p-10 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => router.push("/portal/orders")}>
          Volver
        </Button>
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
  const cancellable = order.status === "pending" //|| order.status === "confirmed";

  // Filter delivery-only statuses from flow for pickup orders
  const visibleFlow = isDelivery
    ? FLOW
    : FLOW.filter((s) => s !== "in_transit" && s !== "at_destination")
  const rawIdx = visibleFlow.indexOf(order.status as OrderStatusKey)
  const visibleCurrentIdx = rawIdx >= 0 ? rawIdx : 0

  return (
    <motion.div
      className="space-y-4 p-4 pb-24"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex size-10 items-center justify-center rounded-2xl bg-muted transition-colors hover:bg-muted/80 active:scale-95"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Pedido #{order.orderNumber}</h1>
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
        className="rounded-2xl border bg-card p-5 shadow-sm"
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
              <StepIllustration step={order.status} size={100} />
            </div>

            {/* Status message */}
            <p className="mb-4 text-center text-sm font-medium text-muted-foreground">
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

            {/* Progress stepper */}
            <div className="flex items-center">
              {visibleFlow.map((s, i) => (
                <div
                  key={s}
                  className={cn(
                    "flex items-center",
                    i < visibleFlow.length - 1 && "flex-1"
                  )}
                >
                  <div className="flex flex-col items-center overflow-x-auto">
                    <motion.div
                      initial={false}
                      animate={{
                        scale: i === visibleCurrentIdx ? 1.15 : 1,
                      }}
                      className={cn(
                        "flex size-9 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-300",
                        i <= visibleCurrentIdx
                          ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25"
                          : "border-muted-foreground/20 text-muted-foreground"
                      )}
                    >
                      {i < visibleCurrentIdx ? (
                        <CircleCheck className="size-4" />
                      ) : (
                        FLOW_ICONS[s]
                      )}
                    </motion.div>
                    <span className="mt-1.5 text-center text-[10px] leading-tight text-muted-foreground">
                      {ORDER_STATUS_LABELS[s]}
                    </span>
                  </div>
                  {i < visibleFlow.length - 1 && (
                    <div
                      className={cn(
                        "mx-1 mb-5 h-0.5 flex-1 rounded-full transition-colors duration-500",
                        i < visibleCurrentIdx
                          ? "bg-primary"
                          : "bg-muted-foreground/20"
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
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
        {isTransit && isDelivery && (
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, height: 0 }}
            className="rounded-2xl border bg-card shadow-sm overflow-hidden"
          >
            <div className="relative h-52 bg-gradient-to-br from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30">
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 400 200"
                fill="none"
              >
                {/* Grid */}
                <line
                  x1="0"
                  y1="50"
                  x2="400"
                  y2="50"
                  stroke="currentColor"
                  strokeOpacity="0.05"
                />
                <line
                  x1="0"
                  y1="100"
                  x2="400"
                  y2="100"
                  stroke="currentColor"
                  strokeOpacity="0.05"
                />
                <line
                  x1="0"
                  y1="150"
                  x2="400"
                  y2="150"
                  stroke="currentColor"
                  strokeOpacity="0.05"
                />
                <line
                  x1="100"
                  y1="0"
                  x2="100"
                  y2="200"
                  stroke="currentColor"
                  strokeOpacity="0.05"
                />
                <line
                  x1="200"
                  y1="0"
                  x2="200"
                  y2="200"
                  stroke="currentColor"
                  strokeOpacity="0.05"
                />
                <line
                  x1="300"
                  y1="0"
                  x2="300"
                  y2="200"
                  stroke="currentColor"
                  strokeOpacity="0.05"
                />
                {/* Route line */}
                <path
                  d="M50 150 Q200 80 350 120"
                  stroke="#8b5cf6"
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray="6 4"
                  opacity="0.4"
                />
                {/* Origin — sucursal */}
                <circle cx="50" cy="150" r="6" fill="#10b981" opacity="0.2" />
                <circle cx="50" cy="150" r="3" fill="#10b981" />
                <text
                  x="50"
                  y="168"
                  textAnchor="middle"
                  fontSize="8"
                  fill="#10b981"
                  fontWeight="600"
                >
                  Sucursal
                </text>
                {/* Destination — cliente */}
                <circle cx="350" cy="120" r="6" fill="#2563eb" opacity="0.2" />
                <circle cx="350" cy="120" r="3" fill="#2563eb" />
                <text
                  x="350"
                  y="138"
                  textAnchor="middle"
                  fontSize="8"
                  fill="#2563eb"
                  fontWeight="600"
                >
                  Tu dirección
                </text>
                {/* Driver position — real data or fallback animation */}
                {driverLoc ? (
                  <motion.g
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    {/* Pulse ring */}
                    <motion.circle
                      cx={120}
                      cy={135}
                      r="14"
                      fill="#8b5cf6"
                      opacity="0.1"
                      animate={{ r: [14, 20, 14], opacity: [0.15, 0.05, 0.15] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <circle cx={120} cy={135} r="8" fill="#8b5cf6" />
                    <rect
                      x={114}
                      y={129}
                      width="12"
                      height="8"
                      rx="2"
                      fill="#fff"
                    />
                    <circle cx={117} cy={139} r="1.5" fill="#4c1d95" />
                    <circle cx={123} cy={139} r="1.5" fill="#4c1d95" />
                  </motion.g>
                ) : (
                  <motion.g
                    animate={{ x: [0, 260], y: [0, -25] }}
                    transition={{
                      duration: 5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <circle
                      cx={120}
                      cy={140}
                      r="8"
                      fill="#8b5cf6"
                      opacity="0.15"
                    />
                    <rect
                      x={114}
                      y={134}
                      width="12"
                      height="8"
                      rx="2"
                      fill="#8b5cf6"
                    />
                    <circle cx={117} cy={144} r="1.5" fill="#6d28d9" />
                    <circle cx={123} cy={144} r="1.5" fill="#6d28d9" />
                  </motion.g>
                )}
              </svg>
              {/* Overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-card/95 to-transparent p-3">
                <div className="flex items-center gap-2">
                  <Navigation className="size-4 text-violet-600" />
                  <span className="text-xs font-medium">
                    {driverLoc
                      ? "Repartidor en camino — ubicación en tiempo real"
                      : "Tu repartidor va en camino"}
                  </span>
                  {driverLoc && (
                    <span className="ml-auto flex size-2 rounded-full bg-emerald-500">
                      <span className="size-2 animate-ping rounded-full bg-emerald-400" />
                    </span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Productos */}
      <motion.section
        variants={fadeUp}
        className="rounded-2xl border bg-card p-4 shadow-sm"
      >
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
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
          <div className="flex justify-between border-t pt-1 text-base font-bold">
            <span>Total</span>
            <span>{money(order.total)}</span>
          </div>
        </div>
      </motion.section>

      {/* Entrega */}
      <motion.section
        variants={fadeUp}
        className="rounded-2xl border bg-card p-4 shadow-sm"
      >
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
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
                ? "Pago en sucursal"
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
          className="rounded-2xl border bg-card p-4 shadow-sm"
        >
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
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
    </motion.div>
  )
}
