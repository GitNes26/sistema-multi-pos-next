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
} from "lucide-react";
import { DialogComponent } from "@/components/ui/dialog";
import { money } from "@/lib/pos/money";
import {
  DELIVERY_METHOD_LABELS,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
} from "@/lib/orders/client";
import type { OrderDetail } from "@/lib/orders/server";
import { cn } from "@/lib/utils";

const HISTORY_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="size-3.5" />,
  confirmed: <ClipboardList className="size-3.5" />,
  preparing: <PackageCheck className="size-3.5" />,
  ready: <Check className="size-3.5" />,
  delivered: <Truck className="size-3.5" />,
  cancelled: <X className="size-3.5" />,
};

export function PosOrderDetail({
  orderId,
  onClose,
  onChanged,
}: {
  orderId: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) {
      onClose();
      return;
    }
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/pos/orders/${orderId}`);
        const data = await res.json();
        if (alive && data.ok) setOrder(data.order);
      } catch {
        /* noop */
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => { alive = false; };
  }, [open, orderId, onClose]);

  return (
    <DialogComponent
      open={open}
      onOpenChange={(v) => { setOpen(v); if (!v) onClose(); }}
      className="sm:max-w-xl"
      title={
        <>
          Pedido #{order?.orderNumber ?? ""}
          {order && (
            <span className={`ml-2 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${ORDER_STATUS_COLORS[order.status as keyof typeof ORDER_STATUS_COLORS] ?? "bg-muted text-muted-foreground"}`}>
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

          {order.address && (
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <MapPin className="size-4 shrink-0 text-muted-foreground" />
              <span>{order.address}</span>
            </div>
          )}

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
                      <span className="mt-0.5 block text-xs text-muted-foreground">&quot;{i.comment}&quot;</span>
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
              <Clock className="size-4" /> Historial
            </h4>
            {order.history.length === 0 ? (
              <p className="text-xs text-muted-foreground">Sin movimientos.</p>
            ) : (
              <ol className="space-y-2">
                {order.history.map((h) => (
                  <li key={h.id} className="flex items-start gap-2 text-sm">
                    <span className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-primary",
                      h.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-primary/10"
                    )}>
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
                      {h.notes && <span className="block text-xs text-muted-foreground">&quot;{h.notes}&quot;</span>}
                      <time className="block text-[0.65rem] text-muted-foreground/70">
                        {new Date(h.createdAt).toLocaleString("es-MX")}
                      </time>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
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
