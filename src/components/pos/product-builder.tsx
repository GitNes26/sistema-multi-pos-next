"use client"

import { useEffect, useRef, useState, useMemo, useCallback } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Check, ShoppingCart, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { money } from "@/lib/pos/money"
import type {
  PosProduct,
  PosProductOption,
  PosProductOptionValue,
} from "@/types/pos"
import { calculateOptionExtra, calculateOptionValueCharges, optionRuleForVariant, type OptionVariantRule } from "@/lib/products/option-rules"
import { ThumbImage } from "@/components/base/thumb-image"
import { QuantityStepper } from "@/components/base/quantity-stepper"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SelectedOption {
  optionId: string
  optionName: string
  values: { id: string; value: string; extraPrice: number }[]
}

/**
 * Huella estable de una configuración (opciones elegidas): permite al carrito
 * tratar dos configuraciones distintas como líneas separadas.
 */
export function selectedOptionsKey(options: SelectedOption[]): string {
  return options
    .flatMap((opt) => opt.values.map((v) => `${opt.optionId}:${v.id}`))
    .sort()
    .join("|")
}

/** Minimal portal product shape for the builder */
interface PortalProductLike {
  id: string
  name: string
  imageUrl?: string | null
  trackInventory?: boolean
  variants: { id: string; price: number; name?: string; stock?: number; isAvailable?: boolean }[]
  options: {
    id: string
    name: string
    position: number
    required: boolean
    minSelect: number
    maxSelect: number
    appliesToVariantId?: string | null
    variantRules?: OptionVariantRule[]
    effectiveRule?: OptionVariantRule | null
    values: {
      id: string
      value: string
      extraPrice: number
      imageUrl: string | null
      isActive: boolean
    }[]
  }[]
}

interface ProductBuilderProps {
  product?: PosProduct | null
  portalProduct?: PortalProductLike | null
  open: boolean
  onClose: () => void
  onAdd: (config: {
    product: PosProduct | PortalProductLike
    /** Variante elegida (tamaño) — null cuando el producto no tiene variantes. */
    variant: PortalProductLike["variants"][number] | null
    selectedOptions: SelectedOption[]
    totalExtraPrice: number
    notes: string
    quantity: number
  }) => void
}

/* ------------------------------------------------------------------ */
/*  Animated Price Counter                                             */
/* ------------------------------------------------------------------ */

function AnimatedPrice({ value, className }: { value: number; className?: string }) {
  return (
    <motion.span
      key={value}
      initial={{ y: 6, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={cn("inline-block tabular-nums", className)}
    >
      {money(value)}
    </motion.span>
  )
}

/** Regla de selección en palabras simples. */
function ruleText(option: PosProductOption): string {
  const min = option.required ? Math.max(1, option.minSelect) : option.minSelect
  const max = option.maxSelect
  if (max <= 1) return option.required ? "Elige 1" : "Opcional · elige 1"
  if (min > 1 && min === max) return `Elige ${max}`
  if (min >= 1) return `Elige de ${min} a ${max}`
  return `Opcional · hasta ${max}`
}

/* ------------------------------------------------------------------ */
/*  Option value: pastilla o tarjeta con foto                          */
/* ------------------------------------------------------------------ */

function OptionValueButton({
  value,
  isSelected,
  onToggle,
  withImage,
  multi,
}: {
  value: PosProductOptionValue
  isSelected: boolean
  onToggle: () => void
  withImage: boolean
  multi: boolean
}) {
  const disabled = !value.isActive
  if (withImage) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        aria-pressed={isSelected}
        className={cn(
          "relative flex touch-manipulation flex-col overflow-hidden rounded-2xl border-2 bg-card text-left transition-[border-color,box-shadow,transform] duration-200 active:scale-[0.97] disabled:opacity-45",
          isSelected ? "border-primary shadow-e2" : "border-border hover:border-primary/40"
        )}
      >
        <span className="relative aspect-[4/3] w-full bg-muted">
          {value.imageUrl && <ThumbImage src={value.imageUrl} alt="" className="size-full object-cover" />}
          <span
            className={cn(
              "absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full border-2 transition-colors",
              isSelected ? "border-primary bg-primary text-primary-foreground" : "border-white/80 bg-black/20 text-transparent"
            )}
          >
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        </span>
        <span className="flex flex-1 flex-col gap-0.5 p-2">
          <span className="line-clamp-2 text-sm leading-tight font-medium">{value.value}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {disabled ? "Sin existencia" : value.extraPrice > 0 ? `+${money(value.extraPrice)}` : "Sin costo"}
          </span>
        </span>
      </button>
    )
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      aria-pressed={isSelected}
      className={cn(
        "relative inline-flex min-h-12 touch-manipulation items-center gap-2 rounded-xl border-2 px-3.5 py-2 text-sm font-medium transition-[border-color,background-color,transform] duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45",
        isSelected ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card hover:border-primary/40"
      )}
    >
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center border-2 transition-colors",
          multi ? "rounded-md" : "rounded-full",
          isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 text-transparent"
        )}
      >
        <Check className="size-3" strokeWidth={3} />
      </span>
      <span>{value.value}</span>
      {disabled ? (
        <span className="text-xs font-normal text-muted-foreground">Sin existencia</span>
      ) : (
        value.extraPrice > 0 && <span className="text-xs font-semibold text-primary tabular-nums">+{money(value.extraPrice)}</span>
      )}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Option Section                                                     */
/* ------------------------------------------------------------------ */

function OptionSection({
  option,
  selected,
  onToggle,
  showValidation,
  shake,
  sectionRef,
}: {
  option: PosProductOption
  selected: Set<string>
  onToggle: (valueId: string) => void
  showValidation: boolean
  shake: number
  sectionRef: (el: HTMLElement | null) => void
}) {
  const need = option.required ? Math.max(1, option.minSelect) : 0
  const isValid = selected.size >= need
  const withImage = option.values.some((v) => v.imageUrl)
  const multi = option.maxSelect > 1

  return (
    <motion.section
      ref={sectionRef}
      key={shake}
      animate={shake ? { x: [0, -6, 6, -4, 4, 0] } : undefined}
      transition={{ duration: 0.35 }}
      className={cn(
        "scroll-mt-4 space-y-3 rounded-2xl border p-4 transition-colors",
        !isValid && showValidation ? "border-destructive/50 bg-destructive/[0.03]" : isValid && need > 0 ? "border-success/30" : "border-border"
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{option.name}</h3>
          <p className={cn("text-xs", !isValid && showValidation ? "text-destructive" : "text-muted-foreground")}>{ruleText(option)}</p>
        </div>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums transition-colors",
            isValid && need > 0 ? "bg-success/15 text-success-ink" : need > 0 ? "bg-warning/20 text-warning-ink" : "bg-muted text-muted-foreground"
          )}
        >
          {isValid && need > 0 && <Check className="size-3" strokeWidth={3} />}
          {multi ? `${selected.size}/${option.maxSelect}` : isValid && need > 0 ? "Listo" : need > 0 ? "Requerido" : "Opcional"}
        </span>
      </header>
      {option.effectiveRule && (
        <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Incluye {option.effectiveRule.included} sin costo
          {option.effectiveRule.overageMode === "blocked"
            ? "; no admite adicionales."
            : option.effectiveRule.overageMode === "fixed"
              ? `; cada elección adicional cuesta ${money(option.effectiveRule.overagePrice)}.`
              : "; las adicionales conservan el precio indicado."}
        </p>
      )}

      <div className={withImage ? "grid grid-cols-2 gap-2 sm:grid-cols-3" : "flex flex-wrap gap-2"}>
        {option.values.map((value) => (
          <OptionValueButton
            key={value.id}
            value={value}
            isSelected={selected.has(value.id)}
            withImage={withImage}
            multi={multi}
            onToggle={() => value.isActive && onToggle(value.id)}
          />
        ))}
      </div>
      {option.values.length > 0 && option.values.every((value) => !value.isActive) && (
        <p className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning-ink">
          Ninguna opción de esta sección tiene existencias por ahora.
        </p>
      )}
    </motion.section>
  )
}

/* ------------------------------------------------------------------ */
/*  Notes Input                                                        */
/* ------------------------------------------------------------------ */

const NOTE_PRESETS = ["Sin cebolla", "Sin picante", "Extra salsa", "Para llevar", "Bien cocido", "Sin azúcar"]

function NotesInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <section className="space-y-3 rounded-2xl border p-4">
      <header>
        <h3 className="font-semibold">¿Alguna indicación?</h3>
        <p className="text-xs text-muted-foreground">Opcional · toca un atajo o escribe</p>
      </header>
      <div className="flex flex-wrap gap-1.5">
        {NOTE_PRESETS.map((preset) => {
          const isActive = value.toLowerCase().includes(preset.toLowerCase())
          return (
            <button
              key={preset}
              type="button"
              onClick={() => {
                if (isActive) {
                  const regex = new RegExp(`[,;]?\\s*${preset}`, "gi")
                  onChange(value.replace(regex, "").replace(/^[,;\s]+/, "").trim())
                } else {
                  onChange(value ? `${value}, ${preset}` : preset)
                }
              }}
              aria-pressed={isActive}
              className={cn(
                "min-h-9 rounded-full border px-3 text-sm transition-colors active:scale-95",
                isActive ? "border-primary bg-primary/10 text-foreground" : "bg-card text-muted-foreground hover:border-primary/40"
              )}
            >
              {isActive && <Check className="mr-1 inline size-3.5" />}
              {preset}
            </button>
          )
        })}
      </div>
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escribe aquí otra indicación…"
          className="w-full rounded-xl border bg-background px-3.5 py-2.5 pr-9 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
          rows={2}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Borrar indicaciones"
            className="absolute top-2.5 right-2.5 rounded-full bg-muted p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        )}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Main ProductBuilder                                                */
/* ------------------------------------------------------------------ */

export function ProductBuilder({ product, portalProduct, open, onClose, onAdd }: ProductBuilderProps) {
  // Normalize: use portalProduct if provided, else POS product
  const activeProduct = portalProduct ?? product ?? null
  const [selections, setSelections] = useState<Map<string, Set<string>>>(new Map())
  // Tamaño (variante) elegido dentro del constructor, igual en POS y portal.
  const [variantId, setVariantId] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [showValidation, setShowValidation] = useState(false)
  const [shakes, setShakes] = useState<Record<string, number>>({})
  const [bump, setBump] = useState<{ id: number; amount: number } | null>(null)
  const sectionRefs = useRef(new Map<string, HTMLElement>())
  const scrollRef = useRef<HTMLDivElement>(null)

  const variantChoices: PortalProductLike["variants"] = portalProduct
    ? portalProduct.variants
    : product && product.variants.length > 1
      ? product.variants.filter((v) => v.isActive).map((v) => ({ id: v.id, price: v.price, name: v.name, stock: v.stock, isAvailable: v.isAvailable }))
      : []
  const selectedVariant = variantChoices.find((v) => v.id === variantId) ?? variantChoices[0] ?? null
  const effectiveVariantId = selectedVariant?.id ?? product?.variantId
  const activeOptions = useMemo(
    () =>
      (activeProduct?.options ?? [])
        .filter((option) => !option.appliesToVariantId || option.appliesToVariantId === effectiveVariantId)
        .map((option) => {
          const effectiveRule = optionRuleForVariant(option.variantRules, effectiveVariantId)
          return effectiveRule ? { ...option, maxSelect: effectiveRule.maxSelect, effectiveRule } : { ...option, effectiveRule: null }
        }),
    [activeProduct, effectiveVariantId]
  )

  const resetSelections = useCallback(() => {
    setSelections(new Map())
    setVariantId(null)
    setNotes("")
    setQuantity(1)
    setShowValidation(false)
    setShakes({})
  }, [])

  const handleClose = useCallback(() => {
    resetSelections()
    onClose()
  }, [resetSelections, onClose])

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      handleClose()
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [handleClose, open])

  // Si cambia el producto mientras el panel está abierto, empezar de cero
  // (nunca arrastrar selecciones/notas de un producto anterior).
  useEffect(() => {
    resetSelections()
  }, [activeProduct?.id, resetSelections])

  const needOf = (option: PosProductOption) => (option.required ? Math.max(1, option.minSelect) : 0)
  const isSatisfied = useCallback(
    (option: PosProductOption, sel = selections) => (sel.get(option.id)?.size ?? 0) >= (option.required ? Math.max(1, option.minSelect) : 0),
    [selections]
  )

  const scrollToSection = useCallback((id: string) => {
    const el = sectionRefs.current.get(id)
    el?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  const toggleValue = useCallback(
    (option: PosProductOption, valueId: string) => {
      const prev = selections
      const next = new Map(prev)
      const current = new Set(next.get(option.id) ?? new Set<string>())
      let changed = true
      if (current.has(valueId)) {
        current.delete(valueId)
      } else if (option.maxSelect <= 1) {
        current.clear()
        current.add(valueId)
      } else if (current.size < option.maxSelect) {
        current.add(valueId)
      } else {
        // Límite alcanzado: se avisa en lugar de ignorar el toque en silencio.
        changed = false
        setShakes((s) => ({ ...s, [option.id]: (s[option.id] ?? 0) + 1 }))
      }
      if (!changed) return
      if (current.size === 0) next.delete(option.id)
      else next.set(option.id, current)
      setSelections(next)

      const value = option.values.find((v) => v.id === valueId)
      if (value && value.extraPrice > 0 && current.has(valueId)) setBump({ id: Date.now(), amount: value.extraPrice })

      // Selección única completada → pasar a la siguiente sección pendiente.
      if (option.maxSelect <= 1 && current.size === 1) {
        const idx = activeOptions.findIndex((o) => o.id === option.id)
        const nextPending = activeOptions.slice(idx + 1).find((o) => needOf(o) > 0 && (next.get(o.id)?.size ?? 0) < needOf(o))
        if (nextPending) window.setTimeout(() => scrollToSection(nextPending.id), 250)
      }
    },
    [selections, activeOptions, scrollToSection]
  )

  const totalExtraPrice = useMemo(() => {
    if (!activeProduct) return 0
    let total = 0
    for (const option of activeOptions) {
      const selected = selections.get(option.id) ?? new Set()
      total += calculateOptionExtra(option.values.filter((value) => selected.has(value.id)).map((value) => value.extraPrice), option.effectiveRule)
    }
    return total
  }, [activeProduct, activeOptions, selections])

  const missing = useMemo(() => activeOptions.filter((o) => !isSatisfied(o)), [activeOptions, isSatisfied])
  const isValid = Boolean(activeProduct) && missing.length === 0

  const buildSelectedOptions = useCallback((): SelectedOption[] => {
    if (!activeProduct) return []
    const result: SelectedOption[] = []
    for (const option of activeOptions) {
      const selected = selections.get(option.id) ?? new Set()
      if (selected.size === 0) continue
      const values = option.values.filter((v) => selected.has(v.id))
      const charges = calculateOptionValueCharges(values, option.effectiveRule)
      result.push({
        optionId: option.id,
        optionName: option.name,
        values: values.map((v) => ({ id: v.id, value: v.value, extraPrice: charges.get(v.id) ?? 0 })),
      })
    }
    return result
  }, [activeProduct, activeOptions, selections])

  const handleAdd = useCallback(
    (e?: React.MouseEvent) => {
      // En el portal el panel puede montarse dentro del <Link> de la card:
      // sin esto, el clic en «Agregar» burbujea y navega al detalle.
      e?.preventDefault()
      e?.stopPropagation()
      if (!activeProduct) return
      if (!isValid) {
        setShowValidation(true)
        const first = missing[0]
        if (first) {
          scrollToSection(first.id)
          setShakes((s) => ({ ...s, [first.id]: (s[first.id] ?? 0) + 1 }))
        }
        return
      }
      onAdd({
        // En el POS la línea del ticket lleva el tamaño elegido (id, precio y nombre).
        product:
          !portalProduct && product && selectedVariant && variantChoices.length > 1
            ? { ...product, variantId: selectedVariant.id, price: selectedVariant.price, name: `${product.name} · ${selectedVariant.name}` }
            : activeProduct,
        variant: selectedVariant,
        selectedOptions: buildSelectedOptions(),
        totalExtraPrice,
        notes,
        quantity,
      })
      handleClose()
    },
    [activeProduct, isValid, missing, scrollToSection, onAdd, buildSelectedOptions, totalExtraPrice, notes, quantity, handleClose, portalProduct, product, selectedVariant, variantChoices.length]
  )

  if (!activeProduct || activeProduct.options.length === 0) return null

  // Precio base: el del tamaño elegido; si no hay tamaños, el del producto.
  const basePrice = selectedVariant?.price ?? product?.price ?? 0
  const finalPrice = basePrice + totalExtraPrice
  const requiredCount = activeOptions.filter((o) => needOf(o) > 0).length
  const doneCount = requiredCount - missing.length
  const summary = buildSelectedOptions()

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn("fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300", open ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed z-50 flex flex-col overflow-hidden bg-background shadow-e3 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "max-md:inset-x-0 max-md:bottom-0 max-md:h-[95dvh] max-md:rounded-t-3xl",
          "md:inset-y-0 md:right-0 md:w-[540px] md:rounded-l-3xl",
          open ? "max-md:translate-y-0 md:translate-x-0" : "max-md:translate-y-full md:translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label={`Configurar ${activeProduct.name}`}
      >
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {/* Portada */}
          <div className="relative">
            {activeProduct.imageUrl ? (
              <div className="relative h-44 w-full bg-muted sm:h-52">
                <ThumbImage src={activeProduct.imageUrl} alt="" className="size-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
              </div>
            ) : (
              <div className="h-6" />
            )}
            <div className="absolute top-2 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-white/70 md:hidden" />
            <button
              type="button"
              onClick={handleClose}
              aria-label="Cerrar"
              className="absolute top-3 right-3 grid size-10 place-items-center rounded-full bg-background/90 text-foreground shadow-e2 backdrop-blur transition-transform active:scale-90"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className={cn("space-y-1 px-5", activeProduct.imageUrl ? "-mt-10 relative" : "pt-2")}>
            <h2 className="font-heading text-2xl leading-tight font-semibold tracking-tight">{activeProduct.name}</h2>
            <p className="text-sm text-muted-foreground">
              Desde <span className="font-semibold text-foreground tabular-nums">{money(basePrice)}</span>
              {requiredCount > 0 && ` · ${requiredCount} ${requiredCount === 1 ? "elección obligatoria" : "elecciones obligatorias"}`}
            </p>
          </div>

          {/* Avance por secciones (toca para ir) */}
          {activeOptions.length > 1 && (
            <nav aria-label="Secciones" className="sticky top-0 z-10 mt-3 border-b bg-background/95 px-5 py-2.5 backdrop-blur">
              <div className="mb-2 h-1 overflow-hidden rounded-full bg-muted">
                <motion.div className="h-full rounded-full bg-primary" animate={{ width: `${requiredCount ? (doneCount / requiredCount) * 100 : 100}%` }} transition={{ duration: 0.4 }} />
              </div>
              <div className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1">
                {activeOptions.map((o) => {
                  const ok = isSatisfied(o)
                  const req = needOf(o) > 0
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => scrollToSection(o.id)}
                      className={cn(
                        "flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors",
                        ok && req ? "border-success/40 bg-success/10 text-success-ink" : req ? "border-warning/50 text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {ok && req && <Check className="size-3" strokeWidth={3} />}
                      {o.name}
                    </button>
                  )
                })}
              </div>
            </nav>
          )}

          <div className="space-y-4 px-4 py-4 sm:px-5">
            {/* Tamaño primero: las opciones pueden depender de él */}
            {variantChoices.length > 1 && (
              <section className="space-y-3 rounded-2xl border p-4">
                <header>
                  <h3 className="font-semibold">Tamaño</h3>
                  <p className="text-xs text-muted-foreground">Elige 1</p>
                </header>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {variantChoices.map((v) => {
                    const active = selectedVariant?.id === v.id
                    const unavailable = v.isAvailable === false || (activeProduct.trackInventory && (v.stock ?? 0) <= 0)
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={unavailable}
                        onClick={() => setVariantId(v.id)}
                        aria-pressed={active}
                        className={cn(
                          "flex min-h-14 flex-col items-start justify-center rounded-xl border-2 px-3 py-2 text-left transition-colors active:scale-[0.97] disabled:opacity-45",
                          active ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"
                        )}
                      >
                        <span className="text-sm font-semibold">{v.name && v.name !== "Default" ? v.name : "Regular"}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{unavailable ? "Agotado" : money(v.price)}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )}

            {activeOptions.map((option) => (
              <OptionSection
                key={option.id}
                option={option}
                selected={selections.get(option.id) ?? new Set()}
                onToggle={(valueId) => toggleValue(option, valueId)}
                showValidation={showValidation}
                shake={shakes[option.id] ?? 0}
                sectionRef={(el) => {
                  if (el) sectionRefs.current.set(option.id, el)
                  else sectionRefs.current.delete(option.id)
                }}
              />
            ))}

            <NotesInput value={notes} onChange={setNotes} />

            {summary.length > 0 && (
              <section className="space-y-2 rounded-2xl bg-muted/50 p-4">
                <p className="text-sm font-semibold">Tu {activeProduct.name.toLowerCase()} lleva</p>
                <ul className="space-y-1 text-sm">
                  {summary.map((opt) => (
                    <li key={opt.optionId} className="flex gap-2">
                      <span className="shrink-0 text-muted-foreground">{opt.optionName}:</span>
                      <span className="min-w-0">{opt.values.map((v) => v.value + (v.extraPrice > 0 ? ` (+${money(v.extraPrice)})` : "")).join(", ")}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>

        {/* Barra inferior */}
        <div className="relative border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-lg sm:px-5">
          <AnimatePresence>
            {bump && (
              <motion.span
                key={bump.id}
                initial={{ opacity: 0, y: 0, scale: 0.8 }}
                animate={{ opacity: [0, 1, 1, 0], y: -34, scale: 1 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                onAnimationComplete={() => setBump(null)}
                className="pointer-events-none absolute right-6 -top-2 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow-e2 tabular-nums"
              >
                +{money(bump.amount)}
              </motion.span>
            )}
          </AnimatePresence>
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">
              {money(basePrice)}
              {totalExtraPrice > 0 && <> + extras {money(totalExtraPrice)}</>}
              {quantity > 1 && <> · ×{quantity}</>}
            </span>
            {!isValid && requiredCount > 0 && (
              <span className="text-xs font-medium text-warning-ink">
                {missing.length === 1 ? `Falta: ${missing[0].name}` : `Faltan ${missing.length} secciones`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <QuantityStepper value={quantity} min={1} onChange={setQuantity} ariaLabel="Cantidad" />
            <Button
              onClick={handleAdd}
              size="lg"
              className={cn("h-12 flex-1 rounded-xl text-base shadow-e2 transition-[opacity,transform] active:scale-[0.98]", !isValid && "opacity-80")}
            >
              {isValid ? (
                <>
                  <ShoppingCart className="size-5" /> Agregar · <AnimatedPrice value={finalPrice * quantity} />
                </>
              ) : (
                <>Elige {missing[0]?.name.toLowerCase() ?? "las opciones"}</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
