"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { portalApi } from "@/lib/portal/client";
import { usePortalStore } from "@/stores/portal-store";
import { ProductCard } from "@/components/portal/product-card";
import { TapScale } from "@/components/shared/tap-scale";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function StoreClient() {
  const categories = usePortalStore((s) => s.categories);
  const products = usePortalStore((s) => s.products);
  const setStorefront = usePortalStore((s) => s.setStorefront);
  const setFavorites = usePortalStore((s) => s.setFavorites);
  const activeCategory = usePortalStore((s) => s.activeCategory);
  const setActiveCategory = usePortalStore((s) => s.setActiveCategory);
  const search = usePortalStore((s) => s.search);
  const setSearch = usePortalStore((s) => s.setSearch);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <div className="space-y-3 p-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          className="pl-9"
          placeholder="Buscar productos…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            activeCategory === null ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          )}
        >
          Todos
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCategory(c.id)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              activeCategory === c.id ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((p) => (
            <TapScale key={p.id} className="h-full">
              <ProductCard product={p} />
            </TapScale>
          ))}
        </div>
      )}
    </div>
  );
}
