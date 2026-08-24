"use client";

import { useEffect, useState } from "react";
import {
  Check,
  ClipboardList,
  Clock,
  MapPin,
  PackageCheck,
  Truck,
  X,
  CircleCheckBig,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/pos/money";
import { swalError, swalToast } from "@/lib/swal";
import {
  DELIVERY_METHOD_LABELS,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  ordersApi,
  type OrderDetail,
  type OrderStatusKey,
} from "@/lib/orders/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DeliveryConfirmDialog } from "./delivery-confirm-dialog";

const FLOW: OrderStatusKey[] = ["pending", "confirmed", "preparing", "ready", "in_transit", "at_destination", "delivered"];

function getNextAction(status: string, isDelivery: boolean): { label: string; icon: React.ReactNode; color: string } | "navigate" | null {
  if (status === "pending") return { label: "Confirmar", icon: <CircleCheckBig className="size-4" />, color: "bg-sky-600 hover:bg-sky-700" };
  if (status === "confirmed") return "navigate"; // → /prepare
  if (status === "preparing") return "navigate"; // → /prepare
  if (status === "ready") {
    return isDelivery
      ? { label: "Enviar a domicilio", icon: <Truck className="size-4" />, color: "bg-violet-600 hover:bg-violet-700" }
      : { label: "Confirmar recogida (PIN/QR)", icon: <CircleCheckBig className="size-4" />, color: "bg-blue-600 hover:bg-blue-700" };
  }
  if (status === "in_transit") return { label: "Confirmar llegada", icon: <MapPin className="size-4" />, color: "bg-purple-600 hover:bg-purple-700" };
  if (status === "at_destination") return { label: "Confirmar entrega (PIN/QR)", icon: <CircleCheckBig className="size-4" />, color: "bg-blue-600 hover:bg-blue-700" };
  return null;
}

function getNextStatus(status: string, isDelivery: boolean): OrderStatusKey | null {
  if (status === "pending") return "confirmed";
  if (status === "ready" && isDelivery) return "in_transit";
  if (status === "ready") return "delivered";
  if (status === "in_transit") return "at_destination";
  return null;
}

export function OrderDetailDialog({
  orderId,
  canManage,
  onChanged,
}: {
  orderId: string;
  canManage: boolean;
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = async () => {
    try {
      const r = await ordersApi.detail(orderId);
      setOrder(r.order);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = (v: boolean) => {
    if (!v) {
      // Closing — notify parent to refresh, then close
      onChanged?.();
    }
    setOpen(v);
  };

  const nextAction = order ? getNextAction(order.status, order.deliveryMethod === "delivery") : null;
  const isDelivery = order?.deliveryMethod === "delivery";
  const visibleFlow = isDelivery
    ? FLOW
    : FLOW.filter((s) => s !== "in_transit" && s !== "at_destination");
  const currentFlowIdx = order ? visibleFlow.indexOf(order.status as OrderStatusKey) : -1;

  const advanceStatus = async () => {
    if (!order || !nextAction || nextAction === "navigate") return;
    setSaving(true);
    try {
      if (order.status === "pending") {
        const res = await fetch(`/api/orders/${order.id}/confirm`, { method: "POST" });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
      } else if (order.status === "in_transit") {
        // Confirm arrival → at_destination (generates PIN + QR)
        const res = await fetch(`/api/orders/${order.id}/confirm-arrival`, { method: "POST" });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
      } else if (order.status === "at_destination" || (order.status === "ready" && !isDelivery)) {
        // Confirmación con PIN/QR (domicilio en destino o recogida en sucursal)
        setConfirmOpen(true);
        setSaving(false);
        return;
      } else {
        const targetStatus = getNextStatus(order.status, isDelivery);
        if (targetStatus) await ordersApi.updateStatus(order.id, targetStatus);
      }
      swalToast(nextAction.label + " ✓");
      onChanged?.();
      setOpen(false);
    } catch (err) {
      swalError("Error", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogComponent open={open} onOpenChange={handleClose} size="lg" title="Detalle del pedido">
      {loading || !order ? (
        <div className="space-y-3 py-4">
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="h-20 animate-pulse rounded bg-muted" />
          <div className="h-16 animate-pulse rounded bg-muted" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold">Pedido #{order.orderNumber}</h3>
              <p className="text-xs text-muted-foreground">
                {new Date(order.createdAt).toLocaleString("es-MX")} · {order.customerName ?? "Cliente"}
              </p>
            </div>
            <Badge className={cn("text-xs", ORDER_STATUS_COLORS[order.status as OrderStatusKey])}>
              {ORDER_STATUS_LABELS[order.status as OrderStatusKey]}
            </Badge>
          </div>

          {/* Flow progress */}
          {order.status !== "cancelled" && (
            <div className="flex items-center gap-1">
              {visibleFlow.map((s, i) => (
                <div key={s} className={cn("flex items-center", i < visibleFlow.length - 1 && "flex-1")}>
                  <div
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-[10px] font-bold",
                      i <= currentFlowIdx
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {i + 1}
                  </div>
                  {i < visibleFlow.length - 1 && (
                    <div className={cn("mx-0.5 mb-4 h-0.5 flex-1 rounded", i < currentFlowIdx ? "bg-primary" : "bg-muted")} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Items */}
          <div className="rounded-xl border bg-muted/30 p-3">
            <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Productos</h4>
            <div className="space-y-1.5">
              {order.items.map((it) => (
                <div key={it.id} className="flex justify-between text-sm">
                  <span className="min-w-0 truncate">
                    {it.quantity}× {it.productName}
                    {it.variantName ? ` (${it.variantName})` : ""}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">{money(it.lineTotal)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between border-t pt-2 text-sm font-bold">
              <span>Total</span>
              <span>{money(order.total)}</span>
            </div>
          </div>

          {/* Delivery info */}
          <div className="rounded-xl border bg-muted/30 p-3 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              {isDelivery ? <Truck className="size-3.5" /> : <MapPin className="size-3.5" />}
              <span className="font-medium text-foreground">{DELIVERY_METHOD_LABELS[order.deliveryMethod]}</span>
            </div>
            {order.locationName && <p className="mt-1 text-xs text-muted-foreground">{order.locationName}</p>}
            {order.address && <p className="mt-1 text-xs text-muted-foreground">{order.address}</p>}
            {order.notes && <p className="mt-1 text-xs italic text-muted-foreground">&quot;{order.notes}&quot;</p>}
          </div>

          {/* Quick actions */}
          {canManage && order.status !== "cancelled" && order.status !== "delivered" && (
            <div className="space-y-2">
              <AnimatePresence mode="wait">
                {nextAction === "navigate" ? (
                  <motion.div key="nav" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <Button
                      className="w-full bg-orange-600 hover:bg-orange-700"
                      onClick={() => {
                        onChanged?.();
                        window.location.href = `/admin/orders/${order.id}/prepare`;
                      }}
                    >
                      <PackageCheck className="mr-2 size-4" /> Ir a preparación
                    </Button>
                  </motion.div>
                ) : nextAction ? (
                  <motion.div key="advance" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <Button
                      className={cn("w-full", nextAction.color)}
                      onClick={advanceStatus}
                      disabled={saving}
                    >
                      {nextAction.icon}
                      <span className="ml-2">{saving ? "Procesando…" : nextAction.label}</span>
                      <ArrowRight className="ml-auto size-4" />
                    </Button>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {(order.status === "pending" || order.status === "confirmed") && (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await ordersApi.updateStatus(order.id, "cancelled");
                      swalToast("Pedido cancelado");
                      onChanged?.();
                      setOpen(false);
                    } catch (err) {
                      swalError("Error", err instanceof Error ? err.message : undefined);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  disabled={saving}
                >
                  <X className="mr-2 size-4" /> Cancelar pedido
                </Button>
              )}
            </div>
          )}

          {/* History */}
          {order.history.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold text-muted-foreground">Historial</h4>
              <ol className="space-y-1">
                {order.history.map((h, i) => (
                  <li key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="size-1 rounded-full bg-muted-foreground/40" />
                      {ORDER_STATUS_LABELS[h.status as OrderStatusKey] ?? h.status}
                    </span>
                    <time className="text-[0.65rem] text-muted-foreground/70">
                      {new Date(h.createdAt).toLocaleString("es-MX")}
                    </time>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </DialogComponent>

      {order && (
        <DeliveryConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          orderId={order.id}
          orderNumber={order.orderNumber}
          mode={order.deliveryMethod === "delivery" ? "delivery" : "pickup"}
          onConfirmed={() => {
            swalToast(order.deliveryMethod === "delivery" ? "Pedido entregado" : "Pedido recogido");
            onChanged?.();
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
