"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Heart,
  Minus,
  Plus,
  Check,
  Package,
  Scale,
  Layers,
  Share2,
} from "lucide-react"
import { motion, AnimatePresence, LayoutGroup } from "framer-motion"
import { portalApi } from "@/lib/portal/client"
import type { PortalProduct } from "@/lib/portal/server"
import { usePortalStore } from "@/stores/portal-store"
import { money } from "@/lib/pos/money"
import { ProductCard } from "@/components/portal/product-card"
import { TapScale } from "@/components/shared/tap-scale"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { BottomSheet } from "@/components/portal/bottom-sheet"
import { ProductBuilder } from "@/components/pos/product-builder"
import { swalError, swalToast } from "@/lib/swal"
import { cn } from "@/lib/utils"
import { SPRING_BOUNCE, SPRING_DEFAULT, STAGGER_FADE_UP } from "@/lib/animation-tokens"
import { haptic } from "@/lib/haptics"
import { MaskReveal } from "@/components/shared/mask-reveal"

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function DetailSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="aspect-square w-full rounded-2xl" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-20 rounded-full" />
        <Skeleton className="h-10 w-20 rounded-full" />
        <Skeleton className="h-10 w-20 rounded-full" />
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function ProductDetailClient({ productId }: { productId: string }) {
  const router = useRouter()

  const allProducts = usePortalStore((s) => s.products)
  const addStandard = usePortalStore((s) => s.addStandard)
  const setBulkProduct = usePortalStore((s) => s.setBulkProduct)
  const favorites = usePortalStore((s) => s.favorites)
  const toggleFavorite = usePortalStore((s) => s.toggleFavorite)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [product, setProduct] = useState<PortalProduct | null>(null)
  const [related, setRelated] = useState<PortalProduct[]>([])

  // Local UI state
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [justAdded, setJustAdded] = useState(false)
  const [favBusy, setFavBusy] = useState(false)
  const [variantSheet, setVariantSheet] = useState(false)
  const [builderOpen, setBuilderOpen] = useState(false)

  // Fetch product data
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        // Try to find product from existing store first
        const existing = allProducts.find((p) => p.id === productId)
        if (existing) {
          if (!active) return
          setProduct(existing)
          const catProducts = allProducts.filter(
            (p) => p.categoryId === existing.categoryId && p.id !== existing.id
          )
          setRelated(catProducts.slice(0, 6))
          setLoading(false)
          return
        }

        // Otherwise fetch from API
        const store = await portalApi.storefront()
        if (!active) return
        const found = store.products.find((p) => p.id === productId)
        if (!found) {
          setError("Producto no encontrado")
          setLoading(false)
          return
        }
        setProduct(found)
        const catProducts = store.products.filter(
          (p) => p.categoryId === found.categoryId && p.id !== found.id
        )
        setRelated(catProducts.slice(0, 6))
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Error al cargar el producto")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [productId, allProducts])

  const p = product
  const isBulk = p?.kind === "bulk"
  const hasVariants = (p?.variants.length ?? 0) > 1
  const hasOptions = (p?.options?.length ?? 0) > 0
  const selectedVariant = p?.variants[selectedVariantIdx] ?? null
  const outOfStock = isBulk
    ? p?.trackInventory && p.stock <= 0
    : p?.trackInventory && (selectedVariant?.stock ?? 0) <= 0

  const priceLabel = isBulk
    ? p?.bulk
      ? money(p.bulk.price)
      : "—"
    : selectedVariant
      ? money(selectedVariant.price)
      : "—"

  const unitLabel = isBulk && p?.bulk ? `/${p.bulk.unitAbbrev}` : ""

  const favVariantIds = Array.from(favorites)
  const isFav = selectedVariant ? favVariantIds.includes(selectedVariant.id) : false

  // Reset quantity on variant change
  useEffect(() => {
    setQuantity(1)
  }, [selectedVariantIdx])

  const handleFavorite = async () => {
    if (!selectedVariant) return
    setFavBusy(true)
    try {
      if (favVariantIds.includes(selectedVariant.id)) {
        await portalApi.removeFavorite(selectedVariant.id)
      } else {
        await portalApi.addFavorite(selectedVariant.id)
      }
      toggleFavorite(selectedVariant.id)
      haptic.light()
    } catch (err) {
      swalError("Error", err instanceof Error ? err.message : undefined)
    } finally {
      setFavBusy(false)
    }
  }

  const handleAdd = () => {
    if (!p) return
    haptic.light()
    if (isBulk) {
      setBulkProduct(p)
      return
    }
    if (hasOptions) {
      setBuilderOpen(true)
      return
    }
    if (hasVariants) {
      // Add with selected variant
      const v = selectedVariant
      if (!v) return
      const res = addStandard(p, v, quantity)
      if (res.added <= 0) {
        swalToast("Sin stock disponible", "info")
        return
      }
      if (res.limited) {
        swalToast(`Solo quedan ${res.added} disponible${res.added !== 1 ? "s" : ""}`, "info")
      }
      setJustAdded(true)
      haptic.medium()
      setTimeout(() => setJustAdded(false), 1200)
      return
    }
    // Single variant product
    const v = p.variants[0]
    if (!v) return
    const res = addStandard(p, v, quantity)
    if (res.added <= 0) {
      swalToast("Sin stock disponible", "info")
      return
    }
    if (res.limited) {
      swalToast(`Solo quedan ${res.added} disponible${res.added !== 1 ? "s" : ""}`, "info")
    }
    setJustAdded(true)
    haptic.medium()
    setTimeout(() => setJustAdded(false), 1200)
  }

  const handleShare = async () => {
    if (!p) return
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: p.name, url })
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(url)
      swalToast("Enlace copiado", "success")
    }
    haptic.light()
  }

  /* ---------- Render ---------- */

  if (loading) return <DetailSkeleton />

  if (error || !p) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-4 text-center">
        <Package className="size-12 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{error ?? "Producto no encontrado"}</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/portal/store")}>
          <ArrowLeft className="size-4" /> Volver a la tienda
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {/* ── Hero image ── */}
      <div className="relative">
        <Link
          href="/portal/store"
          className="absolute left-3 top-3 z-20 flex size-9 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm shadow-sm"
        >
          <ArrowLeft className="size-5" />
        </Link>

        <button
          type="button"
          onClick={handleShare}
          className="absolute right-3 top-3 z-20 flex size-9 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm shadow-sm"
        >
          <Share2 className="size-4" />
        </button>

        {p.imageUrl ? (
          <MaskReveal shape="wipe" duration={0.7} className="aspect-square w-full">
            <motion.img
              layoutId={`${p.id}-img`}
              src={p.imageUrl}
              alt={p.name}
              className="aspect-square w-full object-cover"
            />
          </MaskReveal>
        ) : (
          <div className="flex aspect-square w-full items-center justify-center bg-muted/50">
            <Package className="size-16 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <motion.div
        className="space-y-4 p-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut", delay: 0.1 }}
      >
        {/* Name + Price + Favorite */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-tight">{p.name}</h1>
            {p.categoryName && (
              <p className="mt-0.5 text-xs text-muted-foreground">{p.categoryName}</p>
            )}
          </div>
          {!isBulk && selectedVariant && (
            <motion.button
              type="button"
              disabled={favBusy}
              onClick={handleFavorite}
              className="flex size-10 shrink-0 items-center justify-center rounded-full border bg-background shadow-sm"
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
                      "size-5 transition-colors",
                      isFav ? "fill-destructive text-destructive" : "text-muted-foreground"
                    )}
                  />
                </motion.div>
              </AnimatePresence>
            </motion.button>
          )}
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums text-primary">
            {priceLabel}
          </span>
          {unitLabel && (
            <span className="text-sm text-muted-foreground">{unitLabel}</span>
          )}
        </div>

        {/* Bulk info */}
        {isBulk && p.bulk && (
          <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Scale className="size-3.5" /> Venta por peso
            </div>
            <p className="mt-1">
              Mínimo {p.bulk.minQty} {p.bulk.unitAbbrev} · Paso {p.bulk.step} {p.bulk.unitAbbrev}
            </p>
            {p.bulk.split && (
              <p className="mt-0.5">
                O {p.bulk.split.price > 0 ? money(p.bulk.split.price) : "gratis"} por{" "}
                {p.bulk.split.unitName} (despacho)
              </p>
            )}
          </div>
        )}

        {/* Description */}
        {p.description && (
          <p className="text-sm leading-relaxed text-muted-foreground">{p.description}</p>
        )}

        {/* Variant selector */}
        {hasVariants && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Variante</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {p.variants.map((v, i) => {
                const vOut = p.trackInventory && v.stock <= 0
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={vOut}
                    onClick={() => {
                      setSelectedVariantIdx(i)
                      haptic.light()
                    }}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
                      vOut && "cursor-not-allowed opacity-40",
                      selectedVariantIdx === i
                        ? "border-primary bg-primary/10 font-semibold text-primary"
                        : "bg-background hover:bg-muted"
                    )}
                  >
                    {v.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.imageUrl} alt={v.name} className="size-8 rounded-lg object-cover" />
                    )}
                    <div className="text-left">
                      <span className="block text-xs font-medium">{v.name}</span>
                      <span className="block text-[11px] tabular-nums">{money(v.price)}</span>
                    </div>
                    {vOut && (
                      <span className="ml-1 text-[10px] text-destructive">Sin stock</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Quantity selector (for non-bulk with stock) */}
        {!isBulk && p.trackInventory && (selectedVariant?.stock ?? 0) > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Cantidad</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setQuantity((q) => Math.max(1, q - 1))
                  haptic.light()
                }}
                disabled={quantity <= 1}
                className="flex size-10 items-center justify-center rounded-full border bg-background transition active:bg-muted disabled:opacity-40"
              >
                <Minus className="size-4" />
              </button>
              <span className="min-w-[3ch] text-center text-lg font-bold tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => {
                  const max = selectedVariant?.stock ?? 99
                  setQuantity((q) => Math.min(max, q + 1))
                  haptic.light()
                }}
                disabled={quantity >= (selectedVariant?.stock ?? 99)}
                className="flex size-10 items-center justify-center rounded-full border bg-background transition active:bg-muted disabled:opacity-40"
              >
                <Plus className="size-4" />
              </button>
            </div>
          </div>
        )}

        {/* Stock info */}
        {p.trackInventory && !isBulk && selectedVariant && (
          <div className="flex items-center gap-2">
            {selectedVariant.stock <= 0 ? (
              <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                Sin stock disponible
              </span>
            ) : selectedVariant.stock <= 8 ? (
              <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600">
                Solo quedan {Math.floor(selectedVariant.stock)} unidades
              </span>
            ) : (
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
                Disponible
              </span>
            )}
          </div>
        )}

        {/* Options notice */}
        {hasOptions && (
          <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Este producto tiene opciones personalizables (sabores, extras, etc.) que podrás elegir
            al agregarlo.
          </p>
        )}

        {/* Add to cart / Out of stock */}
        <div className="pt-2">
          {outOfStock ? (
            <Button
              variant="outline"
              className="h-12 w-full rounded-2xl text-sm"
              onClick={() => swalToast("Te avisaremos cuando haya stock", "info")}
            >
              Sin stock — Avísame
            </Button>
          ) : (
            <Button
              className={cn(
                "h-12 w-full rounded-2xl text-sm font-semibold shadow-md transition-all",
                justAdded && "bg-emerald-500 hover:bg-emerald-500"
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
                    <Check className="size-5" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="plus"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Plus className="size-5" />
                  </motion.div>
                )}
              </AnimatePresence>
              {justAdded ? "¡Agregado!" : hasVariants ? "Agregar al carrito" : "Agregar al carrito"}
            </Button>
          )}
        </div>
      </motion.div>

      {/* ── Related products ── */}
      {related.length > 0 && (
        <motion.div
          className="space-y-3 border-t p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-sm font-semibold">También te puede gustar</h2>
          <LayoutGroup>
            <motion.div
              className="grid grid-cols-2 gap-3"
              variants={STAGGER_FADE_UP.container}
              initial="hidden"
              animate="show"
            >
              {related.map((rp) => (
                <motion.div key={rp.id} variants={STAGGER_FADE_UP.item} layout>
                  <TapScale className="h-full">
                    <Link href={`/portal/store/${rp.id}`}>
                      <ProductCard product={rp} layoutId={rp.id} />
                    </Link>
                  </TapScale>
                </motion.div>
              ))}
            </motion.div>
          </LayoutGroup>
        </motion.div>
      )}

      {/* ── Bottom sheets ── */}
      <BottomSheet
        open={variantSheet}
        onOpenChange={setVariantSheet}
        title={p.name}
        description="Elige una variante para agregar."
      >
        <div className="space-y-2">
          {p.variants.map((v) => {
            const vOut = p.trackInventory && v.stock <= 0
            const name = v.name === "Default" || v.name === "Estándar" ? "Estándar" : v.name
            return (
              <button
                key={v.id}
                type="button"
                disabled={vOut}
                onClick={() => {
                  const res = addStandard(p, v, quantity)
                  setVariantSheet(false)
                  if (res.added <= 0) {
                    swalToast("Sin stock disponible", "info")
                    return
                  }
                  setJustAdded(true)
                  haptic.medium()
                  setTimeout(() => setJustAdded(false), 1200)
                }}
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
                  ) : p.trackInventory ? (
                    <span className="block text-xs text-muted-foreground">
                      {Math.floor(v.stock)} disponibles
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums">{money(v.price)}</span>
                <Plus className="size-4 shrink-0 text-muted-foreground" />
              </button>
            )
          })}
        </div>
      </BottomSheet>

      {hasOptions && (
        <ProductBuilder
          portalProduct={p}
          open={builderOpen}
          onClose={() => setBuilderOpen(false)}
          onAdd={(config) => {
            const variant = p.variants[0]
            if (!variant) return
            const res = addStandard(p, variant, config.quantity)
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
    </div>
  )
}
