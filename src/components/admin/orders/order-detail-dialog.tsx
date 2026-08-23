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
import { Textarea } from "@/components/ui/textarea";
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

const NEXT_STEP: Record<string, { label: string; icon: React.ReactNode; color: string } | null> = {
  pending: { label: "Confirmar", icon: <CircleCheckBig className="size-4" />, color: "bg-sky-600 hover:bg-sky-700" },
  confirmed: { label: "Iniciar preparación", icon: <PackageCheck className="size-4" />, color: "bg-orange-600 hover:bg-orange-700" },
  preparing: null, // goes to preparation page
  ready: { label: "Marcar listo", icon: <Check className="size-4" />, color: "bg-emerald-600 hover:bg-emerald-700" },
  in_transit: { label: "Marcar entregado", icon: <CircleCheckBig className="size-4" />, color: "bg-blue-600 hover:bg-blue-700" },
  delivered: null,
  cancelled: null,
};

const FLOW: OrderStatusKey[] = ["pending", "confirmed", "preparing", "ready", "in_transit", "delivered"];

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
  const notes = "";

  const load = async () => {
    setLoading(true);
    try {
      const r = await ordersApi.detail(orderId);
      setOrder(r.order);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openChange = (v: boolean) => {
    setOpen(v);
    if (v) load();
  };

  const nextStep = order ? NEXT_STEP[order.status] : null;
  const isDelivery = order?.deliveryMethod === "delivery";
  const currentFlowIdx = order ? FLOW.indexOf(order.status as OrderStatusKey) : -1;

  const advanceStatus = async () => {
    if (!order || !nextStep) return;
    setSaving(true);
    try {
      if (order.status === "pending") {
        const res = await fetch(`/api/orders/${order.id}/confirm`, { method: "POST" });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
      } else if (order.status === "ready" && isDelivery) {
        const res = await fetch(`/api/orders/${order.id}/deliver`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: notes || undefined }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
      } else if (order.status === "in_transit") {
        await ordersApi.updateStatus(order.id, "delivered", notes || undefined);
      } else {
        await ordersApi.updateStatus(order.id, "confirmed", notes || undefined);
      }
      swalToast(nextStep.label + " ✓");
      onChanged?.();
      setOpen(false);
    } catch (err) {
      swalError("Error", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogComponent open={open} onOpenChange={openChange} size="lg" title="Detalle del pedido">
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
              {FLOW.filter((s) => !(isDelivery === false && s === "in_transit")).map((s, i) => (
                <div key={s} className={cn("flex items-center", i < FLOW.length - 1 && "flex-1")}>
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
                  {i < FLOW.length - 1 && (
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
                {order.status === "preparing" ? (
                  <motion.div key="prepare" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <Button
                      className="w-full bg-orange-600 hover:bg-orange-700"
                      onClick={() => {
                        setOpen(false);
                        window.location.href = `/admin/orders/${order.id}/prepare`;
                      }}
                    >
                      <PackageCheck className="mr-2 size-4" /> Ir a preparación
                    </Button>
                  </motion.div>
                ) : nextStep ? (
                  <motion.div key="next" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <Button
                      className={cn("w-full", nextStep.color)}
                      onClick={advanceStatus}
                      disabled={saving}
                    >
                      {nextStep.icon}
                      <span className="ml-2">{saving ? "Procesando…" : nextStep.label}</span>
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
                      await ordersApi.updateStatus(order.id, "cancelled", notes || undefined);
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
  );
}
