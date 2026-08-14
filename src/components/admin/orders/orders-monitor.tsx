"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { PackageCheck, RefreshCw, Truck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { money } from "@/lib/pos/money";
import { swalError } from "@/lib/swal";
import {
  DELIVERY_METHOD_LABELS,
  ORDER_STATUS_LABELS,
  ordersApi,
} from "@/lib/orders/client";
import type { OrderRow } from "@/lib/orders/server";
import { OrderDetailDialog } from "./order-detail-dialog";

// FASE 12.4 — Monitoreo de pedidos (semáforo de estados).

const MONITOR_STATUSES = ["pending", "confirmed", "preparing", "ready"] as const;

const STATUS_CARD_STYLE: Record<string, string> = {
  pending: "border-amber-300 bg-amber-50/60 dark:bg-amber-950/20",
  confirmed: "border-sky-300 bg-sky-50/60 dark:bg-sky-950/20",
  preparing: "border-orange-300 bg-orange-50/60 dark:bg-orange-950/20",
  ready: "border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20",
};

const STATUS_DOT: Record<string, string> = {
  pending: "bg-amber-500",
  confirmed: "bg-sky-500",
  preparing: "bg-orange-500",
  ready: "bg-emerald-500",
};

export function OrdersMonitor({
  canManage,
  icon,
}: {
  canManage: boolean;
  icon?: React.ReactNode;
}) {
  const router = useRouter();
  const [byStatus, setByStatus] = useState<Record<string, OrderRow[]>>({ pending: [], confirmed: [], preparing: [], ready: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(() => new Date());

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const r = await ordersApi.list({ active: true, pageSize: 200 });
      const grouped: Record<string, OrderRow[]> = { pending: [], confirmed: [], preparing: [], ready: [] };
      for (const o of r.rows) {
        if (grouped[o.status]) grouped[o.status].push(o);
      }
      setByStatus(grouped);
      setLastUpdate(new Date());
    } catch (err) {
      swalError("No se pudo cargar el monitoreo", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => load(true), 30_000);
    return () => clearInterval(t);
  }, [load]);

  const activeTotal = MONITOR_STATUSES.reduce((a, s) => a + (byStatus[s]?.length ?? 0), 0);

  return (
    <>
      <PageHeader
        icon={icon ?? <Truck className="size-5" />}
        title="Monitoreo de pedidos"
        description="Semáforo de estados en tiempo real."
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {activeTotal} activo(s) · {lastUpdate.toLocaleTimeString("es-MX")}
            </span>
            <Button size="sm" variant="outline" onClick={() => load(true)} disabled={refreshing}>
              <RefreshCw className={cn("size-4", refreshing && "animate-spin")} /> Refrescar
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {MONITOR_STATUSES.map((status) => (
            <section key={status} className="rounded-xl border bg-card">
              <header className={cn("flex items-center gap-2 rounded-t-xl border-b px-3 py-2", STATUS_CARD_STYLE[status])}>
                <span className={cn("size-2.5 rounded-full", STATUS_DOT[status])} />
                <span className="text-sm font-semibold">{ORDER_STATUS_LABELS[status]}</span>
                <Badge variant="secondary" className="ml-auto">{byStatus[status]?.length ?? 0}</Badge>
              </header>
              <div className="space-y-2 p-2">
                {(byStatus[status] ?? []).length === 0 && (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground">Sin pedidos</p>
                )}
                {(byStatus[status] ?? []).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setDetailId(o.id)}
                    className={cn("w-full rounded-lg border px-3 py-2 text-left transition-colors hover:shadow-sm", STATUS_CARD_STYLE[status])}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold tabular-nums">#{o.orderNumber}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true, locale: es })}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-sm">{o.customerName ?? "Cliente"}</div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{DELIVERY_METHOD_LABELS[o.deliveryMethod]}</span>
                      <span className="font-semibold tabular-nums">{money(o.total)}</span>
                    </div>
                    {canManage && status === "preparing" && (
                      <div className="mt-2">
                        <Button
                          size="xs"
                          variant="outline"
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/admin/orders/${o.id}/prepare`);
                          }}
                        >
                          <PackageCheck className="size-3.5" /> Preparar
                        </Button>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {detailId && (
        <OrderDetailDialog
          orderId={detailId}
          canManage={canManage}
          onChanged={() => {
            setDetailId(null);
            load();
          }}
        />
      )}
    </>
  );
}