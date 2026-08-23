"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, ClipboardList } from "lucide-react";
import { portalApi } from "@/lib/portal/client";
import type { PortalOrderRow } from "@/lib/portal/server";
import { money } from "@/lib/pos/money";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, type OrderStatusKey } from "@/lib/orders/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PullToRefresh } from "@/components/shared/pull-to-refresh";
import { EmptyState } from "@/components/shared/empty-state";

export function OrdersClient() {
  const [orders, setOrders] = useState<PortalOrderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
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

  if (error) return <p className="p-6 text-center text-sm text-muted-foreground">{error}</p>;

  return (
    <PullToRefresh onRefresh={load}>
      <div className="space-y-3 p-4">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <ClipboardList className="size-5 text-primary" /> Mis pedidos
        </h1>
        {!orders ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Aún no has hecho pedidos"
            description="Tus pedidos aparecerán aquí."
          />
        ) : (
          orders.map((o, i) => (
            <motion.div
              key={o.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
            >
              <Link
                href={`/portal/orders/${o.id}`}
                className="flex items-center justify-between rounded-2xl border bg-card p-4 shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
              >
                <div>
                  <p className="text-sm font-bold">Pedido #{o.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(o.createdAt).toLocaleDateString("es-MX", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {o.itemsCount} productos · {money(o.total)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge className={ORDER_STATUS_COLORS[o.status as OrderStatusKey]}>
                    {ORDER_STATUS_LABELS[o.status as OrderStatusKey]}
                  </Badge>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </Link>
            </motion.div>
          ))
        )}
      </div>
    </PullToRefresh>
  );
}
