"use client"

import { useEffect, useMemo, useRef } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { STAGGER_COMPACT, STAGGER } from "@/lib/animation-tokens"
import { Keyboard, Package, Puzzle, ScanBarcode, Search } from "lucide-react"
import { usePosStore } from "@/stores/pos-store"
import type { PosCombo, PosProduct } from "@/types/pos"
import { ProductCard } from "./product-card"
import { ComboCard } from "./combo-card"
import { VirtualKeyboard } from "./virtual-keyboard"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const COMBOS_CATEGORY_ID = "__combos__"

interface CatalogPanelProps {
  onSelect: (product: PosProduct) => void
  onSelectCombo: (combo: PosCombo) => void
  collapsed: boolean
  onToggleCollapsed: () => void
}

export function CatalogPanel({
  onSelect,
  onSelectCombo,
  collapsed,
  onToggleCollapsed,
}: CatalogPanelProps) {
  const products = usePosStore((s) => s.products)
  const combos = usePosStore((s) => s.combos)
  const categories = usePosStore((s) => s.categories)
  const activeCategory = usePosStore((s) => s.activeCategory)
  const setActiveCategory = usePosStore((s) => s.setActiveCategory)
  const search = usePosStore((s) => s.search)
  const setSearch = usePosStore((s) => s.setSearch)
  const scanRefocus = usePosStore((s) => s.scanRefocus)
  const keyboardOpen = usePosStore((s) => s.keyboardOpen)
  const setKeyboardOpen = usePosStore((s) => s.setKeyboardOpen)

  const inputRef = useRef<HTMLInputElement>(null)

  // 6.13 – El campo de búsqueda mantiene el foco (lector de código de barras).
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()
  }, [scanRefocus])

  // 6.5 – Al coincidir exactamente con SKU o código de barras, se agrega directo.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => {
      if (activeCategory && p.categoryId !== activeCategory) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.barcode ?? "").includes(q)
      )
    })
  }, [products, activeCategory, search])

  useEffect(() => {
    const q = search.trim()
    if (!q) return
    const match = products.find(
      (p) => (p.sku && p.sku === q) || (p.barcode && p.barcode === q)
    )
    if (match) {
      setSearch("")
      onSelect(match)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const addFirst = () => {
    if (!filtered.length) return
    const match = search.trim()
      ? products.find(
          (p) =>
            p.name.toLowerCase() === search.trim().toLowerCase() ||
            p.sku === search.trim().toLowerCase() ||
            p.barcode === search.trim()
        )
      : null
    onSelect(match ?? filtered[0])
    setSearch("")
  }

  if (collapsed) {
    return (
      <div className="flex h-full flex-col gap-2 p-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleCollapsed}
          className="justify-start"
        >
          <Package className="size-4" /> Mostrar productos ({products.length})
        </Button>
      </div>
    )
  }

  const withCount = [
    { id: "", name: "Todos", imageUrl: null, productCount: products.length },
    ...categories,
    ...(combos.length > 0 ? [{ id: COMBOS_CATEGORY_ID, name: "Combos", imageUrl: null, productCount: combos.length }] : []),
  ]

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addFirst()}
            placeholder="Buscar por nombre, SKU o código de barras…"
            className="h-10 pl-9 md:pl-9 pr-16 md:pr-16"
            aria-label="Buscar productos"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
            <ScanBarcode className="size-4" />
          </span>
        </div>
        <Button
          type="button"
          variant={keyboardOpen ? "secondary" : "outline"}
          size="icon"
          className="size-10 shrink-0"
          onClick={() => {
            const next = !keyboardOpen
            setKeyboardOpen(next)
            if (next) setTimeout(() => inputRef.current?.focus(), 0)
          }}
          aria-label="Teclado virtual"
        >
          <Keyboard className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleCollapsed}
          aria-label="Contraer productos"
        >
          <Package className="size-4" />
        </Button>
      </div>

      {keyboardOpen && (
        <VirtualKeyboard
          target={inputRef}
          onDone={() => setKeyboardOpen(false)}
        />
      )}

      <motion.div
        className="scrollbar-none flex shrink-0 items-center gap-1.5 overflow-x-auto pb-1"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: STAGGER.TIGHT } },
        }}
      >
        {withCount.map((c) => (
          <motion.button
            key={c.id}
            type="button"
            onClick={() => setActiveCategory(c.id || null)}
            variants={{
              hidden: { opacity: 0, scale: 0.85 },
              show: { opacity: 1, scale: 1 },
            }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition",
              activeCategory === (c.id || null)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            )}
          >
            {c.name}
            <span
              className={cn(
                "ml-1 opacity-60",
                activeCategory === (c.id || null) && "text-primary-foreground"
              )}
            >
              {c.productCount}
            </span>
          </motion.button>
        ))}
      </motion.div>

      <div className="scrollbar-none flex-1 overflow-y-auto pb-4">
        {activeCategory === COMBOS_CATEGORY_ID ? (
          combos.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
              <Puzzle className="size-6" />
              <p className="text-sm">No hay combos disponibles.</p>
            </div>
          ) : (
            <motion.div
              className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5"
              variants={STAGGER_COMPACT.container}
              initial="hidden"
              animate="show"
            >
              <AnimatePresence mode="popLayout">
                {combos.map((c) => (
                  <motion.div
                    key={c.id}
                    variants={STAGGER_COMPACT.item}
                    layout
                  >
                    <ComboCard combo={c} onSelect={onSelectCombo} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <Search className="size-6" />
            <p className="text-sm">Sin resultados para “{search}”.</p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5"
            variants={STAGGER_COMPACT.container}
            initial="hidden"
            animate="show"
          >
            <AnimatePresence mode="popLayout">
              {filtered.map((p) => (
                <motion.div
                  key={p.id}
                  variants={STAGGER_COMPACT.item}
                  layout
                >
                  <ProductCard product={p} onSelect={onSelect} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  )
}
