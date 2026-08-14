"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HeartOff } from "lucide-react";
import { portalApi } from "@/lib/portal/client";
import { usePortalStore } from "@/stores/portal-store";
import { ProductCard } from "@/components/portal/product-card";
import { TapScale } from "@/components/shared/tap-scale";
import { PullToRefresh } from "@/components/shared/pull-to-refresh";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export function FavoritesClient() {
  const products = usePortalStore((s) => s.products);
  const favorites = usePortalStore((s) => s.favorites);
  const setStorefront = usePortalStore((s) => s.setStorefront);
  const setFavorites = usePortalStore((s) => s.setFavorites);

  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [store, favs] = await Promise.all([portalApi.storefront(), portalApi.favorites()]);
    setStorefront(store.categories, store.products);
    setFavorites(favs.variantIds);
  }, [setStorefront, setFavorites]);

  useEffect(() => {
    let active = true;
    load().finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [load]);

  const favProducts = useMemo(
    () => products.filter((p) => p.variants.some((v) => favorites.has(v.id))),
    [products, favorites]
  );

  return (
    <PullToRefresh onRefresh={load}>
      <div className="space-y-3 p-4">
        <h1 className="text-lg font-semibold">Favoritos</h1>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-xl" />
            ))}
          </div>
        ) : favProducts.length === 0 ? (
          <EmptyState
            icon={HeartOff}
            title="No tienes productos favoritos"
            description="Toca el corazón en un producto para guardarlo."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {favProducts.map((p) => (
              <TapScale key={p.id} className="h-full">
                <ProductCard product={p} />
              </TapScale>
            ))}
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
