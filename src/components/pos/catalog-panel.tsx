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
import { ThumbImage } from "@/components/base/thumb-image"
import { categoryBranchIds } from "@/lib/catalog/categories"
import { looksLikeCustomerQr, parseCustomerQr } from "@/lib/customer-qr"
import { swalToast } from "@/lib/swal"
import { haptic } from "@/lib/haptics"

const COMBOS_CATEGORY_ID = "__combos__"
const UNCATEGORIZED_CATEGORY_ID = "__uncategorized__"

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
  const customers = usePosStore((s) => s.customers)
  const setCustomer = usePosStore((s) => s.setCustomer)

  const inputRef = useRef<HTMLInputElement>(null)
  const activeCategoryIds = useMemo(
    () => categoryBranchIds(categories, activeCategory),
    [categories, activeCategory]
  )

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
      if (activeCategory === UNCATEGORIZED_CATEGORY_ID && p.categoryId) return false
      if (
        activeCategory &&
        activeCategory !== UNCATEGORIZED_CATEGORY_ID &&
        activeCategory !== COMBOS_CATEGORY_ID &&
        (!p.categoryId || !activeCategoryIds.has(p.categoryId))
      ) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.barcode ?? "").includes(q)
      )
    })
  }, [products, activeCategory, activeCategoryIds, search])

  useEffect(() => {
    const q = search.trim()
    if (!q) return
    // QR del cliente (portal → "Mi perfil"): lo asigna a la venta en curso.
    const customerId = parseCustomerQr(q)
    if (customerId) {
      const customer = customers.find((c) => c.id === customerId)
      if (customer) {
        setSearch("")
        setCustomer(customer.id)
        haptic.success()
        swalToast(`Cliente: ${customer.fullName}`)
      }
      return
    }
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
    // Enter con el campo vacío (p. ej. el lector ya resolvió el código) no agrega nada.
    if (!search.trim()) return
    if (looksLikeCustomerQr(search)) {
      // El QR llegó completo y no corresponde a un cliente de esta empresa.
      setSearch("")
      haptic.error()
      swalToast("Este QR no corresponde a un cliente de esta empresa", "warning")
      return
    }
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
    ...(products.some((product) => !product.categoryId)
      ? [{ id: UNCATEGORIZED_CATEGORY_ID, name: "Sin categoría", imageUrl: null, productCount: products.filter((product) => !product.categoryId).length }]
      : []),
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
            placeholder="Buscar o escanear código…"
            className="h-11 pl-9 pr-16 text-base md:h-11 desk:h-11 md:pl-9 desk:pl-9 md:pr-16 desk:pr-16"
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
          className="size-11 shrink-0 touch-manipulation"
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
              "h-11 shrink-0 touch-manipulation rounded-full border px-4 text-sm font-medium transition-colors duration-200",
              activeCategory === (c.id || null)
                ? "border-primary bg-primary text-primary-foreground shadow-e1"
                : "border-border bg-card text-foreground/75 hover:bg-muted hover:text-foreground"
            )}
          >
            {c.imageUrl && (
              <ThumbImage
                src={c.imageUrl}
                alt=""
                className={cn(
                  "mr-1 inline-block size-4 rounded-full object-cover align-[-2px]",
                  activeCategory === (c.id || null) && "ring-1 ring-primary-foreground/60"
                )}
              />
            )}
            {c.name}
            <span
              className={cn(
                "ml-1.5 tabular opacity-60",
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
              <span className="flex size-12 items-center justify-center rounded-2xl bg-muted">
                <Puzzle className="size-5" />
              </span>
              <p className="text-sm">No hay combos disponibles en esta sucursal.</p>
            </div>
          ) : (
            <motion.div
              className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 md:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]"
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
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              {search.trim() ? <Search className="size-5" /> : <Package className="size-5" />}
            </span>
            <div className="space-y-1">
              <p className="font-medium">
                {looksLikeCustomerQr(search)
                  ? "Leyendo QR del cliente…"
                  : search.trim()
                    ? `Nada coincide con “${search.trim()}”`
                    : "Esta categoría no tiene productos"}
              </p>
              <p className="text-sm text-muted-foreground">
                {looksLikeCustomerQr(search)
                  ? "Si no se asigna solo, presiona Enter para confirmar la lectura."
                  : search.trim()
                  ? "Revisa la ortografía, prueba con el SKU o escanea el código de barras."
                  : "Elige otra categoría o agrégalos desde el panel de productos."}
              </p>
            </div>
            {search.trim() && (
              <Button variant="outline" onClick={() => setSearch("")}>Limpiar búsqueda</Button>
            )}
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 md:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]"
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
