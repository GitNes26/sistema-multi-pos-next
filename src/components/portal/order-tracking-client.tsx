"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, XCircle, Package, MapPin, Clock, CreditCard, StickyNote, History, CircleCheck } from "lucide-react";
import { motion } from "framer-motion";
import { portalApi } from "@/lib/portal/client";
import type { PortalOrderDetail } from "@/lib/portal/server";
import { money } from "@/lib/pos/money";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, type OrderStatusKey } from "@/lib/orders/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { swalConfirm, swalError, swalToast } from "@/lib/swal";
import { cn } from "@/lib/utils";

const FLOW: OrderStatusKey[] = ["pending", "confirmed", "preparing", "ready", "delivered"];

const FLOW_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="size-3.5" />,
  confirmed: <CircleCheck className="size-3.5" />,
  preparing: <Package className="size-3.5" />,
  ready: <Package className="size-3.5" />,
  delivered: <CircleCheck className="size-3.5" />,
};

function statusIndex(status: string): number {
  return FLOW.indexOf(status as OrderStatusKey);
}

export function OrderTrackingClient({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<PortalOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    portalApi
      .order(orderId)
      .then((d) => setOrder(d.order))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  // SSE tracking
  useEffect(() => {
    const es = new EventSource(`/api/portal/orders/${orderId}/stream`);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as { status: string };
        setOrder((prev) => (prev ? { ...prev, status: data.status } : prev));
      } catch {
        // ignore
      }
    };
    return () => es.close();
  }, [orderId]);

  const cancel = async () => {
    const ok = await swalConfirm("Cancelar pedido", "¿Seguro que quieres cancelar este pedido?");
    if (!ok) return;
    setCancelling(true);
    try {
      const res = await portalApi.cancelOrder(orderId);
      setOrder(res.order);
      swalToast("Pedido cancelado", "info");
    } catch (err) {
      swalError("No se pudo cancelar", err instanceof Error ? err.message : undefined);
    } finally {
      setCancelling(false);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 p-10 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => router.push("/portal/orders")}>
          Volver
        </Button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-40 rounded-xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  const currentIdx = statusIndex(order.status);
  const isCancelled = order.status === "cancelled";
  const cancellable = order.status === "pending" || order.status === "confirmed";

  return (
    <div className="space-y-4 p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex size-10 items-center justify-center rounded-full bg-muted transition-colors hover:bg-muted/80 active:scale-95"
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
        <Badge className={cn("text-xs", ORDER_STATUS_COLORS[order.status as OrderStatusKey])}>
          {ORDER_STATUS_LABELS[order.status as OrderStatusKey]}
        </Badge>
      </div>

      {/* Progreso */}
      {isCancelled ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-center"
        >
          <XCircle className="mx-auto mb-2 size-8 text-destructive" />
          <p className="text-sm font-medium text-destructive">Pedido cancelado</p>
        </motion.div>
      ) : (
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center">
            {FLOW.map((s, i) => (
              <div key={s} className={cn("flex items-center", i < FLOW.length - 1 && "flex-1")}>
                <div className="flex flex-col items-center">
                  <motion.div
                    initial={false}
                    animate={{
                      scale: i === currentIdx ? 1.1 : 1,
                      backgroundColor: i <= currentIdx ? "hsl(var(--primary))" : "transparent",
                    }}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                      i <= currentIdx
                        ? "border-primary text-primary-foreground"
                        : "border-muted-foreground/30 text-muted-foreground"
                    )}
                  >
                    {i < currentIdx ? (
                      <CircleCheck className="size-4" />
                    ) : (
                      FLOW_ICONS[s]
                    )}
                  </motion.div>
                  <span className="mt-1.5 text-center text-[10px] leading-tight text-muted-foreground">
                    {ORDER_STATUS_LABELS[s]}
                  </span>
                </div>
                {i < FLOW.length - 1 && (
                  <div
                    className={cn(
                      "mx-1 mb-5 h-0.5 flex-1 rounded-full",
                      i < currentIdx ? "bg-primary" : "bg-muted-foreground/20"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Productos */}
      <section className="rounded-2xl border bg-card p-4 shadow-sm">
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
                  <p className="text-xs text-muted-foreground">{it.bulkQuantityDisplay}</p>
                )}
                {it.comment && <p className="text-xs italic text-muted-foreground">&quot;{it.comment}&quot;</p>}
              </div>
              <span className="shrink-0 font-medium tabular-nums">{money(it.lineTotal)}</span>
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
      </section>

      {/* Entrega */}
      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <MapPin className="size-4 text-primary" /> Entrega
        </h2>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            {order.deliveryMethod === "pickup" ? "Recoger en sucursal" : "A domicilio"}
          </p>
          {order.locationName && <p>{order.locationName}</p>}
          {order.address && <p>{order.address}</p>}
          {order.paymentMethod && (
            <p className="flex items-center gap-1.5">
              <CreditCard className="size-3.5" />
              {order.paymentMethod === "cash" ? "Pago en sucursal" : `Tarjeta •••• ${order.paymentReference ?? ""}`}
            </p>
          )}
          {order.notes && (
            <p className="flex items-start gap-1.5 italic">
              <StickyNote className="mt-0.5 size-3.5 shrink-0" />
              &quot;{order.notes}&quot;
            </p>
          )}
        </div>
      </section>

      {/* Historial */}
      {order.history.length > 0 && (
        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <History className="size-4 text-primary" /> Historial
          </h2>
          <div className="space-y-1.5">
            {order.history.map((h, i) => (
              <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
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
        </section>
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
    </div>
  );
}
