"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, HeartOff } from "lucide-react";
import { portalApi } from "@/lib/portal/client";
import { usePortalStore } from "@/stores/portal-store";
import { ProductCard } from "@/components/portal/product-card";
import { TapScale } from "@/components/shared/tap-scale";
import { PullToRefresh } from "@/components/shared/pull-to-refresh";
import { EmptyState } from "@/components/shared/empty-state";
import { SwipeableRow } from "@/components/shared/swipeable-row";
import { Skeleton } from "@/components/ui/skeleton";
import { STAGGER } from "@/lib/animation-tokens";

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

  const removeFavorite = async (variantId: string) => {
    try {
      await portalApi.removeFavorite(variantId);
      usePortalStore.getState().toggleFavorite(variantId);
    } catch {
      // silent
    }
  };

  return (
    <PullToRefresh onRefresh={load}>
      <div className="space-y-4 p-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Heart className="size-5 text-primary fill-primary/30" />
          <h1 className="text-lg font-bold">Favoritos</h1>
          {favProducts.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
              {favProducts.length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
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
            <AnimatePresence>
              {favProducts.map((p, idx) => {
                const firstFavVariant = p.variants.find((v) => favorites.has(v.id));
                return (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: idx * STAGGER.COMPACT }}
                  >
                    <SwipeableRow
                      onDelete={() => {
                        if (firstFavVariant) removeFavorite(firstFavVariant.id);
                      }}
                    >
                      <TapScale className="h-full">
                        <ProductCard product={p} />
                      </TapScale>
                    </SwipeableRow>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
