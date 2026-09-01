"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Bell, Heart, Plus, Check, Package, Scale, Layers } from "lucide-react"
import type { PortalProduct, PortalVariantOption } from "@/lib/portal/server"
import { money } from "@/lib/pos/money"
import { usePortalStore } from "@/stores/portal-store"
import { portalApi } from "@/lib/portal/client"
import { swalError, swalToast } from "@/lib/swal"
import { Button } from "@/components/ui/button"
import { BottomSheet } from "@/components/portal/bottom-sheet"
import { ProductBuilder } from "@/components/pos/product-builder"
import { cn } from "@/lib/utils"

function PlaceholderImage() {
  return (
    <div className="flex aspect-square w-full items-center justify-center bg-muted/50 text-muted-foreground">
      <Package className="size-8 text-muted-foreground/50" />
    </div>
  )
}

function StockBadge({ stock, track }: { stock: number; track: boolean }) {
  if (!track) {
    return (
      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">—</span>
    )
  }
  if (stock <= 0) {
    return <span className="rounded-full bg-destructive/90 px-1.5 py-0.5 text-[10px] font-bold text-white">Sin stock</span>
  }
  if (stock <= 8) {
    return <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{Math.floor(stock)} u</span>
  }
  return <span className="rounded-full bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white">{Math.floor(stock)} u</span>
}

export function ProductCard({ product }: { product: PortalProduct }) {
  const setBulkProduct = usePortalStore((s) => s.setBulkProduct)
  const addStandard = usePortalStore((s) => s.addStandard)
  const favorites = usePortalStore((s) => s.favorites)
  const toggleFavorite = usePortalStore((s) => s.toggleFavorite)

  const [variantSheet, setVariantSheet] = useState(false)
  const [builderOpen, setBuilderOpen] = useState(false)
  const [favBusy, setFavBusy] = useState(false)
  const [justAdded, setJustAdded] = useState(false)

  const isBulk = product.kind === "bulk"
  const defaultVariant = product.variants[0] ?? null
  const hasVariants = product.variants.length > 1
  const hasOptions = product.options && product.options.length > 0
  const outOfStock = isBulk
    ? product.trackInventory && product.stock <= 0
    : product.trackInventory && (defaultVariant?.stock ?? 0) <= 0

  const favVariantIds = Array.from(favorites)
  const isFav = defaultVariant ? favVariantIds.includes(defaultVariant.id) : false

  const priceLabel = isBulk
    ? product.bulk
      ? money(product.bulk.price)
      : "—"
    : defaultVariant
      ? money(defaultVariant.price)
      : "—"

  const unitLabel = isBulk && product.bulk ? `/${product.bulk.unitAbbrev}` : ""

  const handleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!defaultVariant) return
    setFavBusy(true)
    try {
      if (favVariantIds.includes(defaultVariant.id)) {
        await portalApi.removeFavorite(defaultVariant.id)
      } else {
        await portalApi.addFavorite(defaultVariant.id)
      }
      toggleFavorite(defaultVariant.id)
    } catch (err) {
      swalError("Error", err instanceof Error ? err.message : undefined)
    } finally {
      setFavBusy(false)
    }
  }

  const addVariant = (v: PortalVariantOption) => {
    const res = addStandard(product, v)
    setVariantSheet(false)
    if (res.added <= 0) {
      swalToast("Sin stock disponible", "info")
      return
    }
    if (res.limited) {
      swalToast(`Solo quedan ${res.added} disponible${res.added !== 1 ? "s" : ""}`, "info")
    }
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 1200)
  }

  const handleAdd = () => {
    if (isBulk) {
      setBulkProduct(product)
      return
    }
    if (hasOptions) {
      setBuilderOpen(true)
      return
    }
    if (hasVariants) {
      setVariantSheet(true)
      return
    }
    if (!defaultVariant) return
    addVariant(defaultVariant)
  }

  return (
    <>
      <motion.div
        className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
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

          {/* Badge a granel */}
          {isBulk && (
            <span className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-md bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              <Scale className="size-3" /> A granel
            </span>
          )}

          {/* Favorite button */}
          {!isBulk && defaultVariant && (
            <motion.button
              type="button"
              disabled={favBusy}
              onClick={handleFavorite}
              className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full bg-background/70 backdrop-blur-sm"
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
          )}

          {/* Variantes badge */}
          {hasVariants && (
            <span className="absolute bottom-1.5 right-1.5 z-10 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
              <Layers className="size-3" /> {product.variants.length} variantes
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1 p-3">
          <p className="line-clamp-2 text-[13px] font-semibold leading-tight">{product.name}</p>

          <div className="flex items-end justify-between gap-1">
            <p className="text-sm font-bold text-primary tabular-nums">
              {priceLabel}
              {unitLabel && <span className="ml-0.5 text-[11px] font-normal text-muted-foreground">{unitLabel}</span>}
            </p>
            <StockBadge stock={isBulk ? product.stock : (defaultVariant?.stock ?? 0)} track={product.trackInventory} />
          </div>

          <div className="mt-auto pt-1.5">
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
                {justAdded ? "¡Agregado!" : hasVariants ? "Elegir" : "Agregar"}
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Sheet de variantes (estilo POS, como BottomSheet) */}
      <BottomSheet
        open={variantSheet}
        onOpenChange={setVariantSheet}
        title={product.name}
        description="Elige una variante para agregar."
      >
        <div className="space-y-2">
          {product.variants.map((v) => {
            const vOut = product.trackInventory && v.stock <= 0
            const name = v.name === "Default" || v.name === "Estándar" ? "Estándar" : v.name
            return (
              <button
                key={v.id}
                type="button"
                disabled={vOut}
                onClick={() => addVariant(v)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
                  vOut ? "cursor-not-allowed opacity-50" : "active:bg-muted"
                )}
              >
                <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/60">
                  {v.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.imageUrl} alt={name} className="size-full object-cover" />
                  ) : (
                    <Layers className="size-5 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{name}</span>
                  {vOut ? (
                    <span className="block text-xs text-muted-foreground">Sin stock</span>
                  ) : product.trackInventory ? (
                    <span className="block text-xs text-muted-foreground">{Math.floor(v.stock)} disponibles</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums">{money(v.price)}</span>
                <Plus className="size-4 shrink-0 text-muted-foreground" />
              </button>
            )
          })}
        </div>
      </BottomSheet>

      {/* ProductBuilder for configurable products */}
      {hasOptions && (
        <ProductBuilder
          portalProduct={product}
          open={builderOpen}
          onClose={() => setBuilderOpen(false)}
          onAdd={(config) => {
            const variant = product.variants[0]
            if (!variant) return
            // For portal, we add with default variant and extra price as modifier
            const res = addStandard(product, variant, config.quantity)
            if (res.added <= 0) {
              swalToast("Sin stock disponible", "info")
              return
            }
            setBuilderOpen(false)
            setJustAdded(true)
            setTimeout(() => setJustAdded(false), 1200)
          }}
        />
      )}
    </>
  )
}
