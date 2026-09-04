"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { portalApi } from "@/lib/portal/client";
import { usePortalStore } from "@/stores/portal-store";
import { ProductCard } from "@/components/portal/product-card";
import { TapScale } from "@/components/shared/tap-scale";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
import { STAGGER_FADE_UP, STAGGER } from "@/lib/animation-tokens";
import { ExpandableFAB } from "@/components/shared/expandable-fab"
import { SwipeableProductCard } from "@/components/shared/swipeable-product-card"
import { ScanBarcode, Heart, ListChecks } from "lucide-react"
import { swalToast } from "@/lib/swal"

export function StoreClient() {
  const categories = usePortalStore((s) => s.categories);
  const products = usePortalStore((s) => s.products);
  const setStorefront = usePortalStore((s) => s.setStorefront);
  const setFavorites = usePortalStore((s) => s.setFavorites);
  const activeCategory = usePortalStore((s) => s.activeCategory);
  const setActiveCategory = usePortalStore((s) => s.setActiveCategory);
  const search = usePortalStore((s) => s.search);
  const setSearch = usePortalStore((s) => s.setSearch);
  const addStandard = usePortalStore((s) => s.addStandard);
  const favorites = usePortalStore((s) => s.favorites);
  const toggleFavorite = usePortalStore((s) => s.toggleFavorite);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [store, favs] = await Promise.all([
          portalApi.storefront(),
          portalApi.favorites(),
        ]);
        if (!active) return;
        setStorefront(store.categories, store.products);
        setFavorites(favs.variantIds);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Error al cargar la tienda");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [setStorefront, setFavorites]);

  const filtered = useMemo(() => {
    let list = products;
    if (activeCategory) list = list.filter((p) => p.categoryId === activeCategory);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.categoryName ?? "").toLowerCase().includes(q));
    return list;
  }, [products, activeCategory, search]);

  return (
    <div className="relative space-y-3 p-4">
      <div className="relative z-10">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          className="pl-9 md:pl-9"
          placeholder="Buscar productos…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
      </div>

      {/* Backdrop blur overlay when search is active */}
      <AnimatePresence>
        {searchFocused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none absolute inset-0 z-[5] bg-background/60 backdrop-blur-md"
          />
        )}
      </AnimatePresence>

      <motion.div
        className="flex gap-2 overflow-x-auto pb-1"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: STAGGER.NORMAL } },
        }}
      >
        <motion.button
          type="button"
          onClick={() => setActiveCategory(null)}
          variants={{
            hidden: { opacity: 0, y: 8 },
            show: { opacity: 1, y: 0 },
          }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            activeCategory === null ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          )}
        >
          Todos
        </motion.button>
        {categories.map((c) => (
          <motion.button
            key={c.id}
            type="button"
            onClick={() => setActiveCategory(c.id)}
            variants={{
              hidden: { opacity: 0, y: 8 },
              show: { opacity: 1, y: 0 },
            }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              activeCategory === c.id ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {c.name}
          </motion.button>
        ))}
      </motion.div>

      {error && (
        <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-square w-full rounded-2xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No hay productos que coincidan</p>
      ) : (
        <LayoutGroup>
          <motion.div
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
            variants={STAGGER_FADE_UP.container}
            initial="hidden"
            animate="show"
          >
            {filtered.map((p) => {
              const defaultVariant = p.variants[0]
              const isFav = defaultVariant ? Array.from(favorites).includes(defaultVariant.id) : false
              return (
                <motion.div key={p.id} variants={STAGGER_FADE_UP.item} layout>
                  <SwipeableProductCard
                    onSwipeLeft={() => {
                      if (!defaultVariant) return
                      const res = addStandard(p, defaultVariant)
                      if (res.added <= 0) {
                        swalToast("Sin stock disponible", "info")
                        return
                      }
                      swalToast("Producto agregado al carrito", "success")
                    }}
                    onSwipeRight={() => {
                      if (!defaultVariant) return
                      toggleFavorite(defaultVariant.id)
                      swalToast(isFav ? "Eliminado de favoritos" : "Agregado a favoritos", "success")
                    }}
                  >
                    <TapScale className="h-full">
                      <Link href={`/portal/store/${p.id}`}>
                        <ProductCard product={p} layoutId={p.id} />
                      </Link>
                    </TapScale>
                  </SwipeableProductCard>
                </motion.div>
              )
            })}
          </motion.div>
        </LayoutGroup>
      )}

      {/* Cloning principle: FAB that expands into sub-actions */}
      <ExpandableFAB
        className="bottom-24 right-4"
        actions={[
          { icon: <ScanBarcode className="size-5" />, label: "Escanear", onClick: () => setSearch("") },
          { icon: <Heart className="size-5" />, label: "Favoritos", onClick: () => window.location.href = "/portal/favorites" },
          { icon: <ListChecks className="size-5" />, label: "Mi lista", onClick: () => window.location.href = "/portal/lists" },
        ]}
      />
    </div>
  );
}
