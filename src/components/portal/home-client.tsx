"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Megaphone, Sparkles } from "lucide-react";
import { portalApi } from "@/lib/portal/client";
import type { PortalHomeData } from "@/lib/portal/server";
import { money } from "@/lib/pos/money";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, type OrderStatusKey } from "@/lib/orders/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

const PUB_TYPE_LABELS: Record<string, string> = {
  product_new: "Nuevo",
  promotion: "Promoción",
  notice: "Aviso",
};

const PUB_TYPE_COLORS: Record<string, string> = {
  product_new: "bg-emerald-500 text-white",
  promotion: "bg-amber-500 text-white",
  notice: "bg-sky-500 text-white",
};

export function HomeClient() {
  const [data, setData] = useState<PortalHomeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    portalApi
      .home()
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e instanceof Error ? e.message : "Error"));
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return <p className="p-6 text-center text-sm text-muted-foreground">{error}</p>;
  }
  if (!data) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  const activeOrders = data.activeOrders.filter((o) => o.status !== "cancelled");
  const banners = data.publications.filter((p) => p.imageUrl);

  return (
    <div className="space-y-5 p-4">
      {/* Puntos */}
      <div className="flex items-center justify-between rounded-xl bg-gradient-to-br from-primary to-primary/70 p-4 text-primary-foreground">
        <div>
          <p className="text-xs opacity-80">Puntos acumulados</p>
          <p className="text-2xl font-bold">{money(data.points)}</p>
        </div>
        <Link href="/portal/loyalty" className="flex items-center gap-1 text-xs opacity-90">
          Ver historial <ChevronRight className="size-4" />
        </Link>
      </div>

      {/* Banners promocionales (18.4) */}
      {banners.length > 0 && (
        <section>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {banners.map((pub) => (
              <div key={pub.id} className="relative h-36 w-72 shrink-0 overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pub.imageUrl ?? ""} alt={pub.title} className="h-full w-full object-cover" />
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 to-transparent p-3">
                  <Badge className={PUB_TYPE_COLORS[pub.type] ?? "bg-secondary"}>
                    {PUB_TYPE_LABELS[pub.type] ?? pub.type}
                  </Badge>
                  <p className="mt-1 line-clamp-2 text-sm font-semibold text-white">{pub.title}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pedidos activos */}
      {activeOrders.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Pedidos activos</h2>
          <div className="space-y-2">
            {activeOrders.map((o) => (
              <Link key={o.id} href={`/portal/orders/${o.id}`} className="flex items-center justify-between rounded-xl border p-3">
                <div>
                  <p className="text-sm font-medium">Pedido #{o.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {o.itemsCount} productos · {money(o.total)}
                  </p>
                </div>
                <Badge className={ORDER_STATUS_COLORS[o.status as OrderStatusKey]}>
                  {ORDER_STATUS_LABELS[o.status as OrderStatusKey]}
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Promociones */}
      {data.promotions.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> Promociones
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {data.promotions.map((p) => (
              <Card key={p.id} className="w-52 shrink-0 overflow-hidden">
                {p.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.name} className="h-24 w-full object-cover" />
                )}
                <div className="p-2.5">
                  <p className="text-sm font-medium leading-tight">{p.name}</p>
                  {p.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Novedades */}
      {data.newProducts.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Productos nuevos</h2>
          <div className="grid grid-cols-4 gap-2">
            {data.newProducts.map((p) => (
              <Link key={p.id} href="/portal/store" className="flex flex-col items-center gap-1 text-center">
                <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border bg-muted">
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Sin imagen</span>
                  )}
                </div>
                <span className="line-clamp-2 text-[11px] leading-tight">{p.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Publicaciones */}
      {data.publications.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Megaphone className="size-4 text-primary" /> Avisos
          </h2>
          <div className="space-y-2">
            {data.publications.map((pub) => (
              <div key={pub.id} className="flex items-start gap-2.5 rounded-xl border p-3">
                {pub.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pub.imageUrl} alt={pub.title} className="size-12 shrink-0 rounded-md object-cover" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{pub.title}</p>
                    <Badge className={PUB_TYPE_COLORS[pub.type] ?? "bg-secondary"}>
                      {PUB_TYPE_LABELS[pub.type] ?? pub.type}
                    </Badge>
                  </div>
                  {pub.content && <p className="mt-1 text-xs text-muted-foreground">{pub.content}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
