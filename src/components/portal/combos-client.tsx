"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Puzzle, Tag, ShoppingCart, Check, ArrowLeft, Package } from "lucide-react"
import { portalApi } from "@/lib/portal/client"
import type { PortalCombo } from "@/lib/portal/server"
import { usePortalStore } from "@/stores/portal-store"
import { money } from "@/lib/pos/money"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { TapScale } from "@/components/shared/tap-scale"
import { cn } from "@/lib/utils"
import { STAGGER_FADE_UP } from "@/lib/animation-tokens"
import Link from "next/link"

const { container, item } = STAGGER_FADE_UP;

export function CombosClient() {
  const [combos, setCombos] = useState<PortalCombo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let active = true
    portalApi
      .combos()
      .then((d) => {
        if (active) setCombos(d.combos)
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Error")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const addStandard = usePortalStore((s) => s.addStandard)
  const setCartOpen = usePortalStore((s) => s.setCartOpen)

  const handleAddCombo = (combo: PortalCombo) => {
    // Add combo as a single product entry at the combo price
    // Each item in the combo becomes a line in the cart
    for (const ci of combo.items) {
      const product = {
        productId: combo.id + "-" + ci.id,
        name: `${combo.name} — ${ci.productName}`,
        imageUrl: null,
        categoryId: "",
        taxRate: 0,
        trackInventory: false,
      }
      const variant = {
        id: combo.id + "-" + ci.id,
        name: ci.variantName || "Default",
        price: ci.extraPrice, // Individual item extra price (combo discount applied at checkout)
        imageUrl: null,
        stock: 999,
        isActive: true,
      }
      addStandard(product as never, variant as never, ci.quantity)
    }
    setAddedIds((prev) => new Set(prev).add(combo.id))
    setCartOpen(true)
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev)
        next.delete(combo.id)
        return next
      })
    }, 2000)
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <Puzzle className="size-12 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Link href="/portal">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-1 size-3" />
            Volver al inicio
          </Button>
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-5 p-4"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={item} className="flex items-center gap-3">
        <Link href="/portal" className="flex size-8 items-center justify-center rounded-full bg-muted transition hover:bg-muted/80">
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-lg font-bold">Combos especiales</h1>
          <p className="text-xs text-muted-foreground">
            {combos.length} combo{combos.length !== 1 ? "s" : ""} disponible{combos.length !== 1 ? "s" : ""}
          </p>
        </div>
      </motion.div>

      {/* Empty state */}
      {combos.length === 0 && (
        <motion.div variants={item} className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
            <Puzzle className="size-8 text-muted-foreground/30" />
          </div>
          <p className="text-sm text-muted-foreground">No hay combos disponibles</p>
          <Link href="/portal/store">
            <Button variant="outline" size="sm">
              <Package className="mr-1 size-3" />
              Ver productos
            </Button>
          </Link>
        </motion.div>
      )}

      {/* Combo grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {combos.map((combo) => {
          const isAdded = addedIds.has(combo.id)
          return (
            <motion.div key={combo.id} variants={item}>
              <TapScale>
                <div
                  className={cn(
                    "relative overflow-hidden rounded-2xl border-2 border-dashed bg-card shadow-sm transition",
                    "hover:border-emerald-500/70 hover:shadow-md",
                    isAdded && "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                  )}
                >
                  {/* Combo badge */}
                  <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                    <Puzzle className="size-3" />
                    COMBO
                  </div>

                  {/* Item count */}
                  <div className="absolute right-3 top-3 z-10 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white">
                    {combo.items.length} productos
                  </div>

                  {/* Image */}
                  {combo.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={combo.imageUrl}
                      alt={combo.name}
                      className="h-40 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20">
                      <Puzzle className="size-12 text-emerald-400" />
                    </div>
                  )}

                  <div className="p-4">
                    {/* Name */}
                    <h3 className="text-base font-bold">{combo.name}</h3>

                    {/* Description */}
                    {combo.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {combo.description}
                      </p>
                    )}

                    {/* Items list */}
                    <div className="mt-3 space-y-1.5">
                      {combo.items.map((ci) => (
                        <div key={ci.id} className="flex items-center gap-2 text-xs">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            {ci.quantity}
                          </span>
                          <span className="text-foreground">
                            {ci.productName}
                            {ci.variantName && ci.variantName !== "Default" && (
                              <span className="text-muted-foreground"> ({ci.variantName})</span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Price and action */}
                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                            {money(combo.comboPrice)}
                          </span>
                          {combo.originalPrice > combo.comboPrice && (
                            <span className="text-xs text-muted-foreground line-through">
                              {money(combo.originalPrice)}
                            </span>
                          )}
                        </div>
                        {combo.savings > 0 && (
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
                            <Tag className="size-3" />
                            Ahorra {money(combo.savings)}
                          </div>
                        )}
                      </div>

                      <Button
                        size="sm"
                        className={cn(
                          "rounded-full px-4 transition",
                          isAdded
                            ? "bg-emerald-500 text-white"
                            : "bg-emerald-600 hover:bg-emerald-700 text-white"
                        )}
                        onClick={() => handleAddCombo(combo)}
                        disabled={isAdded}
                      >
                        {isAdded ? (
                          <>
                            <Check className="mr-1 size-3" />
                            Agregado
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="mr-1 size-3" />
                            Agregar
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </TapScale>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
