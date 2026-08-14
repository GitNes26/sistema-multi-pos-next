"use client";

import { useState } from "react";
import { Bell, Heart, Plus } from "lucide-react";
import type { PortalProduct } from "@/lib/portal/server";
import { money } from "@/lib/pos/money";
import { usePortalStore } from "@/stores/portal-store";
import { portalApi } from "@/lib/portal/client";
import { swalError, swalToast } from "@/lib/swal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function PlaceholderImage() {
  return (
    <div className="flex aspect-square w-full items-center justify-center bg-muted text-muted-foreground">
      <span className="text-xs">Sin imagen</span>
    </div>
  );
}

export function ProductCard({ product }: { product: PortalProduct }) {
  const setBulkProduct = usePortalStore((s) => s.setBulkProduct);
  const addStandard = usePortalStore((s) => s.addStandard);
  const favorites = usePortalStore((s) => s.favorites);
  const toggleFavorite = usePortalStore((s) => s.toggleFavorite);

  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const [favBusy, setFavBusy] = useState(false);

  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];

  if (product.kind === "bulk") {
    const b = product.bulk!;
    const outOfStock = product.trackInventory && product.stock <= 0;
    return (
      <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
        <div className="relative">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt={product.name} className="aspect-square w-full object-cover" />
          ) : (
            <PlaceholderImage />
          )}
          <Badge variant="secondary" className="absolute left-2 top-2">
            A granel
          </Badge>
        </div>
        <div className="flex flex-1 flex-col gap-1 p-2.5">
          <p className="line-clamp-2 text-sm font-medium leading-tight">{product.name}</p>
          <p className="text-sm font-semibold text-primary">
            {money(b.price)}
            <span className="text-xs font-normal text-muted-foreground">/{b.unitAbbrev}</span>
          </p>
          {b.allowSplit && b.split && (
            <p className="text-xs text-muted-foreground">
              ó {money(b.split.price)}/{b.split.unitAbbrev}
            </p>
          )}
          <div className="mt-auto pt-1">
            {outOfStock ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => swalToast("Te avisaremos cuando haya stock", "info")}
              >
                <Bell className="size-3.5" /> Sin stock
              </Button>
            ) : (
              <Button size="sm" className="w-full" onClick={() => setBulkProduct(product)}>
                <Plus className="size-4" /> Agregar
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Estándar
  const outOfStock = product.trackInventory && (variant?.stock ?? 0) <= 0;
  const isFav = variant ? favorites.has(variant.id) : false;

  const handleFavorite = async () => {
    if (!variant) return;
    setFavBusy(true);
    try {
      if (isFav) await portalApi.removeFavorite(variant.id);
      else await portalApi.addFavorite(variant.id);
      toggleFavorite(variant.id);
    } catch (err) {
      swalError("No se pudo actualizar favoritos", err instanceof Error ? err.message : undefined);
    } finally {
      setFavBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
      <div className="relative">
        {variant?.imageUrl || product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={variant?.imageUrl ?? product.imageUrl ?? ""}
            alt={product.name}
            className="aspect-square w-full object-cover"
          />
        ) : (
          <PlaceholderImage />
        )}
        <button
          type="button"
          disabled={favBusy}
          onClick={handleFavorite}
          className={cn(
            "absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-background/80 backdrop-blur transition-colors",
            isFav ? "text-destructive" : "text-muted-foreground hover:text-destructive"
          )}
          aria-label="Favorito"
        >
          <Heart className={cn("size-4", isFav && "fill-current")} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <p className="line-clamp-2 text-sm font-medium leading-tight">{product.name}</p>

        {product.variants.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {product.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVariantId(v.id)}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[11px] transition-colors",
                  v.id === variantId
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {v.name}
              </button>
            ))}
          </div>
        )}

        <p className="text-sm font-semibold text-primary">{variant ? money(variant.price) : "—"}</p>

        <div className="mt-auto pt-1">
          {outOfStock ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => swalToast("Te avisaremos cuando haya stock", "info")}
            >
              <Bell className="size-3.5" /> Sin stock
            </Button>
          ) : (
            <Button
              size="sm"
              className="w-full"
              disabled={!variant}
              onClick={() => variant && addStandard(product, variant)}
            >
              <Plus className="size-4" /> Agregar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
