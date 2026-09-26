"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Bell, Heart, Plus, Check, Package, Scale, Layers } from "lucide-react"
import type { PortalProduct, PortalVariantOption } from "@/lib/portal/server"
import { money } from "@/lib/pos/money"
import { usePortalStore } from "@/stores/portal-store"
import { portalApi } from "@/lib/portal/client"
import { swalError, swalToast } from "@/lib/swal"
import { Button } from "@/components/ui/button"
import { BottomSheet } from "@/components/portal/bottom-sheet"
import {
  ProductBuilder,
  selectedOptionsKey,
} from "@/components/pos/product-builder"
import { cn } from "@/lib/utils"
import { SPRING_BOUNCE, SPRING_DEFAULT } from "@/lib/animation-tokens"
import { haptic } from "@/lib/haptics"
import { MaskReveal } from "@/components/shared/mask-reveal"
import { ThumbImage } from "@/components/base/thumb-image"

function PlaceholderImage() {
  return (
    <div className="flex aspect-square w-full items-center justify-center bg-surface-sunken text-muted-foreground">
      <Package className="size-8 opacity-60" />
    </div>
  )
}

// Para el cliente, la existencia exacta es ruido: solo se avisa cuando
// importa (se agotó o quedan pocas piezas).
function StockBadge({ stock, track }: { stock: number; track: boolean }) {
  if (!track) return null
  if (stock <= 0) {
    return (
      <span className="rounded-full bg-destructive/12 px-2 py-0.5 text-xs font-semibold text-destructive">
        Agotado
      </span>
    )
  }
  if (stock <= 8) {
    return (
      <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning-ink tabular">
        Quedan {Math.floor(stock)}
      </span>
    )
  }
  return null
}

export function ProductCard({
  product,
  layoutId,
  onConfigure,
}: {
  product: PortalProduct
  layoutId?: string
  /** Cuando se proporciona, los productos con opciones delegan la apertura del
   *  constructor al padre (p. ej. la tienda con swipe) en lugar de abrir uno
   *  interno. */
  onConfigure?: (product: PortalProduct) => void
}) {
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
  const outOfStock =
    product.isAvailable === false ||
    defaultVariant?.isAvailable === false ||
    (isBulk
      ? product.trackInventory && product.stock <= 0
      : product.trackInventory && (defaultVariant?.stock ?? 0) <= 0)

  const favVariantIds = Array.from(favorites)
  const isFav = defaultVariant
    ? favVariantIds.includes(defaultVariant.id)
    : false

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
      haptic.light()
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
      swalToast(
        `Solo quedan ${res.added} disponible${res.added !== 1 ? "s" : ""}`,
        "info"
      )
    }
    setJustAdded(true)
    haptic.medium()
    setTimeout(() => setJustAdded(false), 1200)
  }

  const handleAdd = (e?: React.MouseEvent) => {
    // El botón vive dentro de un <Link> a la ficha del producto: sin esto, el
    // clic en «Agregar» también navegaría al detalle en lugar de agregar.
    e?.preventDefault()
    e?.stopPropagation()
    haptic.light()
    if (isBulk) {
      setBulkProduct(product)
      return
    }
    if (hasOptions) {
      if (onConfigure) {
        onConfigure(product)
      } else {
        setBuilderOpen(true)
      }
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
        className="group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card"
        whileTap={{ scale: 0.97 }}
        transition={SPRING_DEFAULT}
      >
        <div className="relative">
          {product.imageUrl ? (
            <MaskReveal shape="circle" duration={0.5} className="aspect-square">
              <ThumbImage
                src={product.imageUrl}
                alt={product.name}
                layoutId={layoutId ? `${layoutId}-img` : undefined}
                className="aspect-square w-full object-cover"
              />
            </MaskReveal>
          ) : (
            <PlaceholderImage />
          )}

          {/* Badge a granel */}
          {isBulk && (
            <span className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full bg-foreground/85 px-2 py-0.5 text-xs font-semibold text-background">
              <Scale className="size-3" /> Granel
            </span>
          )}

          {/* Favorite button */}
          {!isBulk && defaultVariant && (
            <motion.button
              type="button"
              disabled={favBusy}
              onClick={handleFavorite}
              className="absolute right-1.5 top-1.5 z-10 flex size-11 touch-manipulation items-center justify-center rounded-full bg-background/90 shadow-e1 transition-transform active:scale-90 supports-backdrop-filter:backdrop-blur-sm"
              whileTap={{ scale: 0.75 }}
              aria-label="Favorito"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={isFav ? "fav" : "no-fav"}
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.5 }}
                  transition={SPRING_BOUNCE}
                >
                  <Heart
                    className={cn(
                      "size-4 transition-colors",
                      isFav
                        ? "fill-destructive text-destructive"
                        : "text-muted-foreground"
                    )}
                  />
                </motion.div>
              </AnimatePresence>
            </motion.button>
          )}

          {/* Variantes badge */}
          {hasVariants && (
            <span className="absolute bottom-1.5 right-1.5 z-10 flex items-center gap-1 rounded-full bg-background/90 px-2 py-0.5 text-xs font-semibold text-foreground shadow-e1">
              <Layers className="size-3" /> {product.variants.length} variantes
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1 p-3">
          <p className="line-clamp-2 text-sm font-medium leading-snug">
            {product.name}
          </p>
          {product.description && (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {product.description}
            </p>
          )}

          <div className="flex items-end justify-between gap-1">
            <p className="text-base font-bold tracking-tight text-foreground tabular-nums">
              {priceLabel}
              {unitLabel && (
                <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                  {unitLabel}
                </span>
              )}
            </p>
            <StockBadge
              stock={isBulk ? product.stock : (defaultVariant?.stock ?? 0)}
              track={product.trackInventory}
            />
          </div>

          <div className="mt-auto pt-1.5">
            {outOfStock ? (
              <Button
                variant="outline"
                size="sm"
                className="h-11 w-full rounded-xl text-sm"
                onClick={() =>
                  swalToast(
                    product.availabilityNote ||
                      "Este producto no está disponible por el momento",
                    "info"
                  )
                }
              >
                <Bell className="size-3.5" />{" "}
                {product.isAvailable === false ? "Ya no hay" : "Sin stock"}
              </Button>
            ) : (
              <Button
                size="sm"
                className={cn(
                  "h-11 w-full touch-manipulation rounded-xl text-sm font-semibold transition-colors",
                  justAdded && "bg-success text-success-foreground hover:bg-success"
                )}
                onClick={handleAdd}
              >
                <AnimatePresence mode="wait">
                  {justAdded ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Check className="size-4" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="plus"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Plus className="size-4" />
                    </motion.div>
                  )}
                </AnimatePresence>
                {justAdded ? "Agregado" : hasVariants ? "Elegir" : "Agregar"}
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
            const vOut =
              v.isAvailable === false ||
              (product.trackInventory && v.stock <= 0)
            const name =
              v.name === "Default" || v.name === "Estándar"
                ? "Estándar"
                : v.name
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
                    <img
                      src={v.imageUrl}
                      alt={name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <Layers className="size-5 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {name}
                  </span>
                  {vOut ? (
                    <span className="block text-xs text-muted-foreground">
                      {v.isAvailable === false ? "Ya no hay" : "Sin stock"}
                    </span>
                  ) : product.trackInventory ? (
                    <span className="block text-xs text-muted-foreground">
                      {Math.floor(v.stock)} disponibles
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums">
                  {money(v.price)}
                </span>
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
            // Agregar la variante base + los extras elegidos (opciones/notas)
            // como una configuración propia, para que el precio y la línea
            // reflejen exactamente lo que construyó el cliente.
            const res = addStandard(
              product,
              variant,
              config.quantity,
              config.totalExtraPrice,
              selectedOptionsKey(config.selectedOptions),
              config.notes,
              config.selectedOptions
            )
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
