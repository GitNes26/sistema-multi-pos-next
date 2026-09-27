"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Bike, ChevronRight, ClipboardList, Store } from "lucide-react";
import { portalApi } from "@/lib/portal/client";
import type { PortalOrderRow } from "@/lib/portal/server";
import { money } from "@/lib/pos/money";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { STAGGER, DURATION } from "@/lib/animation-tokens";
import { PullToRefresh } from "@/components/shared/pull-to-refresh";
import { EmptyState } from "@/components/shared/empty-state";
import { OrdersEmptyIllustration } from "@/components/shared/animated-illustrations";
import { OrderStatusPill } from "@/components/shared/order-status-pill";
import { SegmentedFilter } from "@/components/base/segmented-filter";
import { ORDER_FLOW_DELIVERY, ORDER_FLOW_PICKUP, ORDER_STATUS_LABELS, type OrderStatusKey } from "@/lib/orders/client";
import { cn } from "@/lib/utils";
import { PortalHero } from "./portal-hero";

// Mis pedidos: lo que está en curso arriba con su avance (como app de
// delivery) y el historial agrupado por mes.

type Filter = "all" | "delivered" | "cancelled";
const ACTIVE = (s: string) => s !== "delivered" && s !== "cancelled";

function ActiveOrderCard({ o }: { o: PortalOrderRow }) {
  const flow = o.deliveryMethod === "delivery" ? ORDER_FLOW_DELIVERY : ORDER_FLOW_PICKUP;
  const step = Math.max(0, flow.indexOf(o.status as OrderStatusKey));
  const pct = ((step + 1) / flow.length) * 100;
  const Method = o.deliveryMethod === "delivery" ? Bike : Store;
  return (
    <Link href={`/portal/orders/${o.id}`} className="press block overflow-hidden rounded-3xl border border-primary/30 bg-card shadow-e2">
      <div className="flex items-center gap-3 p-4">
        <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Method className="size-6" />
          <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full bg-primary">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Pedido #{o.orderNumber} · {o.itemsCount} productos</p>
          <p className="font-heading text-lg font-semibold">{ORDER_STATUS_LABELS[o.status as OrderStatusKey] ?? o.status}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums">{money(o.total)}</p>
          <p className="flex items-center justify-end gap-0.5 text-xs font-medium text-primary">
            Seguir <ChevronRight className="size-3.5" />
          </p>
        </div>
      </div>
      <div className="px-4 pb-4">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className="h-full rounded-full bg-primary" />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
          <span>{ORDER_STATUS_LABELS[flow[0]]}</span>
          <span>{ORDER_STATUS_LABELS[flow[flow.length - 1]]}</span>
        </div>
      </div>
    </Link>
  );
}

export function OrdersClient() {
  const [orders, setOrders] = useState<PortalOrderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await portalApi.listOrders();
      setOrders(d.orders);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = useMemo(() => (orders ?? []).filter((o) => ACTIVE(o.status)), [orders]);
  const past = useMemo(() => (orders ?? []).filter((o) => !ACTIVE(o.status) && (filter === "all" || o.status === filter)), [orders, filter]);
  const byMonth = useMemo(() => {
    const groups = new Map<string, PortalOrderRow[]>();
    for (const o of past) {
      const key = new Date(o.createdAt).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
      groups.set(key, [...(groups.get(key) ?? []), o]);
    }
    return [...groups.entries()];
  }, [past]);
  const delivered = (orders ?? []).filter((o) => o.status === "delivered");
  const spent = delivered.reduce((s, o) => s + o.total, 0);

  if (error) return (
    <div role="alert" className="flex flex-col items-center gap-3 p-6 text-center">
      <p className="text-sm text-muted-foreground">{error}</p>
      <Button variant="outline" onClick={load}>Volver a intentar</Button>
    </div>
  );

  return (
    <PullToRefresh onRefresh={load}>
      <div className="space-y-4 p-4">
        <PortalHero
          icon={ClipboardList}
          tone="info"
          title="Mis pedidos"
          subtitle={active.length ? `${active.length} en curso ahora` : "Sigue tus pedidos y repasa tu historial."}
          stats={orders?.length ? [
            { label: "Pedidos", value: orders.length },
            { label: "Entregados", value: delivered.length },
            { label: "Total comprado", value: money(spent) },
          ] : undefined}
        />

        {!orders ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            illustration={OrdersEmptyIllustration}
            title="Aún no has hecho pedidos"
            description="Tus pedidos aparecerán aquí."
          />
        ) : (
          <>
            {active.length > 0 && (
              <section className="space-y-2">
                <h2 className="px-1 text-sm font-semibold">En curso</h2>
                {active.map((o) => <ActiveOrderCard key={o.id} o={o} />)}
              </section>
            )}

            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <h2 className="text-sm font-semibold">Historial</h2>
                <SegmentedFilter
                  ariaLabel="Historial"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: "all", label: "Todos" },
                    { value: "delivered", label: "Entregados" },
                    { value: "cancelled", label: "Cancelados" },
                  ]}
                />
              </div>
              {byMonth.length === 0 && <p className="rounded-2xl border border-dashed py-8 text-center text-sm text-muted-foreground">Nada por aquí todavía.</p>}
              {byMonth.map(([month, rows]) => (
                <div key={month} className="space-y-1.5">
                  <p className="px-1 text-xs font-medium capitalize text-muted-foreground">{month}</p>
                  <div className="divide-y overflow-hidden rounded-2xl border bg-card">
                    {rows.map((o, i) => {
                      const Method = o.deliveryMethod === "delivery" ? Bike : Store;
                      return (
                        <motion.div key={o.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * STAGGER.NORMAL, duration: DURATION.FAST }}>
                          <Link href={`/portal/orders/${o.id}`} className={cn("flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50", o.status === "cancelled" && "opacity-70")}>
                            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                              <Method className="size-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold">#{o.orderNumber} · {money(o.total)}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(o.createdAt).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · {o.itemsCount} productos
                              </p>
                            </div>
                            <OrderStatusPill status={o.status} />
                            <ChevronRight className="size-4 text-muted-foreground" />
                          </Link>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </PullToRefresh>
  );
}
