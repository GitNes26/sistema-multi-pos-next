"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
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

  // SSE tracking (13.7)
  useEffect(() => {
    const es = new EventSource(`/api/portal/orders/${orderId}/stream`);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as { status: string };
        setOrder((prev) => (prev ? { ...prev, status: data.status } : prev));
      } catch {
        // ignorar
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
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" className="mt-3" onClick={() => router.push("/portal/orders")}>
          Volver
        </Button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const currentIdx = statusIndex(order.status);
  const isCancelled = order.status === "cancelled";
  const cancellable = order.status === "pending" || order.status === "confirmed";

  return (
    <div className="space-y-5 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold">Pedido #{order.orderNumber}</h1>
          <p className="text-xs text-muted-foreground">
            {new Date(order.createdAt).toLocaleString("es-MX", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <Badge className={ORDER_STATUS_COLORS[order.status as OrderStatusKey]}>
          {ORDER_STATUS_LABELS[order.status as OrderStatusKey]}
        </Badge>
      </div>

      {/* Progreso */}
      {isCancelled ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
          Este pedido fue cancelado.
        </div>
      ) : (
        <div className="flex items-center">
          {FLOW.map((s, i) => (
            <div key={s} className={cn("flex items-center", i < FLOW.length - 1 && "flex-1")}>
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border text-xs font-bold",
                    i <= currentIdx
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/30 text-muted-foreground"
                  )}
                >
                  {i + 1}
                </span>
                <span className="mt-1 text-center text-[10px] leading-tight text-muted-foreground">
                  {ORDER_STATUS_LABELS[s]}
                </span>
              </div>
              {i < FLOW.length - 1 && (
                <div
                  className={cn(
                    "mx-1 mb-5 h-0.5 flex-1 rounded",
                    i < currentIdx ? "bg-primary" : "bg-muted-foreground/20"
                  )}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Items */}
      <section className="space-y-2 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">Productos</h2>
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
              {it.comment && <p className="text-xs italic text-muted-foreground">“{it.comment}”</p>}
            </div>
            <span className="shrink-0 tabular-nums">{money(it.lineTotal)}</span>
          </div>
        ))}
        <div className="space-y-1 border-t pt-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{money(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Descuento</span>
            <span>{money(order.discount)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{money(order.total)}</span>
          </div>
        </div>
      </section>

      {/* Entrega */}
      <section className="space-y-1 rounded-xl border p-4 text-sm">
        <h2 className="mb-1 font-semibold">Entrega</h2>
        <p className="text-muted-foreground">
          {order.deliveryMethod === "pickup" ? "Recoger en sucursal" : "A domicilio"}
        </p>
        {order.locationName && <p className="text-muted-foreground">{order.locationName}</p>}
        {order.address && <p className="text-muted-foreground">{order.address}</p>}
        {order.paymentMethod && (
          <p className="text-muted-foreground">
            Pago: {order.paymentMethod === "cash" ? "En sucursal" : `Tarjeta •••• ${order.paymentReference ?? ""}`}
          </p>
        )}
        {order.notes && <p className="italic text-muted-foreground">“{order.notes}”</p>}
      </section>

      {/* Historial */}
      <section className="space-y-1 rounded-xl border p-4 text-sm">
        <h2 className="mb-1 font-semibold">Historial</h2>
        {order.history.length === 0 && <p className="text-xs text-muted-foreground">Sin eventos</p>}
        {order.history.map((h, i) => (
          <div key={i} className="flex justify-between text-xs text-muted-foreground">
            <span>{ORDER_STATUS_LABELS[h.status as OrderStatusKey] ?? h.status}</span>
            <span>
              {new Date(h.createdAt).toLocaleString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        ))}
      </section>

      {cancellable && (
        <Button variant="destructive" className="w-full" onClick={cancel} disabled={cancelling}>
          <XCircle className="size-4" /> Cancelar pedido
        </Button>
      )}
    </div>
  );
}
