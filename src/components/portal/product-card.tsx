"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Bell, Heart, Plus, Check } from "lucide-react"
import type { PortalProduct } from "@/lib/portal/server"
import { money } from "@/lib/pos/money"
import { usePortalStore } from "@/stores/portal-store"
import { portalApi } from "@/lib/portal/client"
import { swalError, swalToast } from "@/lib/swal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function PlaceholderImage() {
  return (
    <div className="flex aspect-square w-full items-center justify-center bg-muted/50 text-muted-foreground">
      <span className="text-xs">Sin imagen</span>
    </div>
  )
}

export function ProductCard({ product }: { product: PortalProduct }) {
  const setBulkProduct = usePortalStore((s) => s.setBulkProduct)
  const addStandard = usePortalStore((s) => s.addStandard)
  const favorites = usePortalStore((s) => s.favorites)
  const toggleFavorite = usePortalStore((s) => s.toggleFavorite)

  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "")
  const [favBusy, setFavBusy] = useState(false)
  const [justAdded, setJustAdded] = useState(false)

  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0]

  const handleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!variant) return
    setFavBusy(true)
    try {
      if (favVariantIds.includes(variant.id)) {
        await portalApi.removeFavorite(variant.id)
      } else {
        await portalApi.addFavorite(variant.id)
      }
      toggleFavorite(variant.id)
    } catch (err) {
      swalError("Error", err instanceof Error ? err.message : undefined)
    } finally {
      setFavBusy(false)
    }
  }

  const handleAdd = () => {
    if (product.kind === "bulk") {
      setBulkProduct(product)
      return
    }
    if (!variant) return
    addStandard(product, variant)
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 1200)
  }

  const favVariantIds = Array.from(favorites)
  const isFav = variant ? favVariantIds.includes(variant.id) : false

  if (product.kind === "bulk") {
    const b = product.bulk!
    const outOfStock = product.trackInventory && product.stock <= 0
    return (
      <motion.div
        className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        <div className="relative overflow-hidden">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt={product.name} className="aspect-square w-full object-cover" />
          ) : (
            <PlaceholderImage />
          )}
          <Badge variant="secondary" className="absolute left-2 top-2 rounded-lg text-[10px] font-semibold">
            A granel
          </Badge>
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <p className="line-clamp-2 text-[13px] font-semibold leading-tight">{product.name}</p>
          <p className="text-sm font-bold text-primary">
            {money(b.price)}
            <span className="text-[11px] font-normal text-muted-foreground">/{b.unitAbbrev}</span>
          </p>
          <div className="mt-auto pt-2">
            {outOfStock ? (
              <Button variant="outline" size="sm" className="h-9 w-full rounded-xl text-xs" onClick={() => swalToast("Te avisaremos cuando haya stock", "info")}>
                <Bell className="size-3.5" /> Sin stock
              </Button>
            ) : (
              <Button size="sm" className="h-9 w-full rounded-xl text-xs font-semibold shadow-sm" onClick={handleAdd}>
                <Plus className="size-4" /> Agregar
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  // Standard
  const outOfStock = product.trackInventory && (variant?.stock ?? 0) <= 0

  return (
    <motion.div
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      <div className="relative overflow-hidden">
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

        {/* Favorite button */}
        <motion.button
          type="button"
          disabled={favBusy}
          onClick={handleFavorite}
          className="absolute right-2.5 top-2.5 flex size-8 items-center justify-center rounded-full bg-background/70 backdrop-blur-sm"
          whileTap={{ scale: 0.75 }}
          aria-label="Favorito"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={isFav ? "fav" : "no-fav"}
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.5 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
            >
              <Heart
                className={cn(
                  "size-4 transition-colors",
                  isFav ? "fill-destructive text-destructive" : "text-muted-foreground"
                )}
              />
            </motion.div>
          </AnimatePresence>
        </motion.button>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="line-clamp-2 text-[13px] font-semibold leading-tight">{product.name}</p>

        {/* Variant chips */}
        {product.variants.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {product.variants.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVariantId(v.id)}
                className={cn(
                  "rounded-lg border px-2 py-0.5 text-[10px] font-medium transition-all",
                  v.id === variantId
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border/50 text-muted-foreground active:bg-muted"
                )}
              >
                {v.name}
              </button>
            ))}
          </div>
        )}

        <p className="text-sm font-bold text-primary">{variant ? money(variant.price) : "—"}</p>

        <div className="mt-auto pt-1">
          {outOfStock ? (
            <Button variant="outline" size="sm" className="h-9 w-full rounded-xl text-xs" onClick={() => swalToast("Te avisaremos cuando haya stock", "info")}>
              <Bell className="size-3.5" /> Sin stock
            </Button>
          ) : (
            <Button
              size="sm"
              className={cn(
                "h-9 w-full rounded-xl text-xs font-semibold shadow-sm transition-all",
                justAdded && "bg-emerald-500 hover:bg-emerald-500"
              )}
              disabled={!variant}
              onClick={handleAdd}
            >
              <AnimatePresence mode="wait">
                {justAdded ? (
                  <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <Check className="size-4" />
                  </motion.div>
                ) : (
                  <motion.div key="plus" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <Plus className="size-4" />
                  </motion.div>
                )}
              </AnimatePresence>
              {justAdded ? "¡Agregado!" : "Agregar"}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
