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
} from "lucide-react";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { money } from "@/lib/pos/money";
import { swalError, swalToast } from "@/lib/swal";
import {
  DELIVERY_METHOD_LABELS,
  ORDER_STATUSES,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  ordersApi,
} from "@/lib/orders/client";
import type { OrderDetail } from "@/lib/orders/server";

// FASE 12.1/12.2 — Detalle de pedido: items, historial de estados y cambio de estado.

const HISTORY_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="size-3.5" />,
  confirmed: <ClipboardList className="size-3.5" />,
  preparing: <PackageCheck className="size-3.5" />,
  ready: <Check className="size-3.5" />,
  in_transit: <Truck className="size-3.5" />,
  delivered: <Truck className="size-3.5" />,
  cancelled: <X className="size-3.5" />,
};

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
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const r = await ordersApi.detail(orderId);
      setOrder(r.order);
      setStatus(r.order.status);
    } catch (err) {
      swalError("No se pudo cargar el pedido", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openChange = (v: boolean) => {
    setOpen(v);
    if (v) load();
  };

  const saveStatus = async () => {
    if (!order || status === order.status) {
      setOpen(false);
      onChanged?.();
      return;
    }
    setSaving(true);
    try {
      await ordersApi.updateStatus(order.id, status, notes || undefined);
      swalToast("Estado actualizado");
      onChanged?.();
      setOpen(false);
    } catch (err) {
      swalError("No se pudo actualizar", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogComponent
      open={open}
      onOpenChange={openChange}
      className="sm:max-w-2xl"
      title={
        <>
          Pedido #{order?.orderNumber ?? ""}
          {order && (
            <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${ORDER_STATUS_COLORS[order.status as keyof typeof ORDER_STATUS_COLORS] ?? "bg-muted text-muted-foreground"}`}>
              {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] ?? order.status}
            </span>
          )}
        </>
      }
    >
        {loading && !order ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : order ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Info label="Cliente" value={order.customerName ?? "—"} />
              <Info label="Entrega" value={DELIVERY_METHOD_LABELS[order.deliveryMethod] ?? order.deliveryMethod} />
              <Info label="Sucursal" value={order.locationName ?? "—"} />
              <Info label="Fecha" value={new Date(order.createdAt).toLocaleString("es-MX")} />
            </div>

            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <PackageCheck className="size-4" /> Productos ({order.items.length})
              </h4>
              <ul className="divide-y rounded-lg border">
                {order.items.map((i) => (
                  <li key={i.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <span className="font-medium">
                        {i.bulkQuantityDisplay ?? `${i.quantity} × ${i.productName}`}
                        {i.variantName && i.productName !== i.variantName ? ` (${i.variantName})` : ""}
                      </span>
                      {i.comment && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">“{i.comment}”</span>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-xs text-muted-foreground">
                        {i.unitPrice > 0 ? `${money(i.unitPrice)}${i.unitName ? `/${i.unitName}` : ""}` : ""}
                      </span>
                      <div className="font-semibold tabular-nums">{money(i.lineTotal)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="text-lg font-bold tabular-nums">{money(order.total)}</span>
            </div>

            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Clock className="size-4" /> Historial de estados
              </h4>
              {order.history.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin movimientos.</p>
              ) : (
                <ol className="space-y-2">
                  {order.history.map((h) => (
                    <li key={h.id} className="flex items-start gap-2 text-sm">
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        {HISTORY_ICONS[h.status] ?? <ClipboardList className="size-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium">
                            {ORDER_STATUS_LABELS[h.status as keyof typeof ORDER_STATUS_LABELS] ?? h.status}
                          </span>
                          {h.employeeName && (
                            <span className="text-xs text-muted-foreground">· {h.employeeName}</span>
                          )}
                        </span>
                        {h.notes && <span className="block text-xs text-muted-foreground">“{h.notes}”</span>}
                        <time className="block text-[0.65rem] text-muted-foreground/70">
                          {new Date(h.createdAt).toLocaleString("es-MX")}
                        </time>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {canManage && order.status !== "cancelled" && order.status !== "delivered" && (
              <div className="space-y-3 rounded-lg border p-3">
                <h4 className="flex items-center gap-1.5 text-sm font-semibold">
                  <MapPin className="size-4" /> Acciones rapida
                </h4>

                {order.status === "pending" && (
                  <Button
                    onClick={async () => {
                      setSaving(true);
                      try {
                        const res = await fetch(`/api/orders/${order.id}/confirm`, { method: "POST" });
                        const data = await res.json();
                        if (data.ok) {
                          swalToast("Pedido confirmado");
                          onChanged?.();
                          setOpen(false);
                        } else {
                          swalError("Error", data.error);
                        }
                      } catch (err) {
                        swalError("Error", err instanceof Error ? err.message : undefined);
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving}
                    className="w-full"
                  >
                    <CircleCheckBig className="mr-2 size-4" />
                    Confirmar pedido
                  </Button>
                )}

                {order.status === "ready" && order.deliveryMethod === "delivery" && (
                  <Button
                    onClick={async () => {
                      setSaving(true);
                      try {
                        const res = await fetch(`/api/orders/${order.id}/deliver`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ notes: notes || undefined }),
                        });
                        const data = await res.json();
                        if (data.ok) {
                          swalToast("Pedido en camino");
                          onChanged?.();
                          setOpen(false);
                        } else {
                          swalError("Error", data.error);
                        }
                      } catch (err) {
                        swalError("Error", err instanceof Error ? err.message : undefined);
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving}
                    className="w-full"
                  >
                    <Truck className="mr-2 size-4" />
                    Enviar a domicilio
                  </Button>
                )}

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">o cambiar manualmente</span>
                  </div>
                </div>

                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUSES.filter((s) => s !== "cancelled").map((s) => (
                      <SelectItem key={s} value={s}>
                        {ORDER_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="Notas del cambio (opcional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cerrar</Button>
                  <Button onClick={saveStatus} disabled={saving}>
                    {saving ? "Guardando…" : "Guardar cambio"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}
    </DialogComponent>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}