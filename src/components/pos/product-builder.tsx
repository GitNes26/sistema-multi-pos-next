"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { motion } from "framer-motion"
import { Check, Minus, Plus, ShoppingCart, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { money } from "@/lib/pos/money"
import type {
  PosProduct,
  PosProductOption,
  PosProductOptionValue,
} from "@/types/pos"
import { calculateOptionExtra, calculateOptionValueCharges, optionRuleForVariant, type OptionVariantRule } from "@/lib/products/option-rules"
import { ThumbImage } from "@/components/base/thumb-image"

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

function AnimatedPrice({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  return (
    <span
      className={cn(
        "tabular-nums transition-all duration-300 ease-out",
        className
      )}
      key={value}
    >
      <span className="inline-block animate-[pricePop_0.3s_ease-out]">
        {money(value)}
      </span>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Option Pill (single value chip)                                    */
/* ------------------------------------------------------------------ */

function OptionPill({
  value,
  isSelected,
  onToggle,
  size = "md",
  disabled = false,
}: {
  value: PosProductOptionValue
  isSelected: boolean
  onToggle: () => void
  size?: "sm" | "md" | "lg"
  disabled?: boolean
}) {
  const sizeClasses = {
    sm: "min-h-11 px-3 py-2 text-xs gap-1.5",
    md: "min-h-12 px-4 py-2.5 text-sm gap-2",
    lg: "min-h-13 px-5 py-3 text-base gap-2.5",
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative inline-flex touch-manipulation items-center rounded-xl border-2 font-medium transition-all duration-200",
        "hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none",
        sizeClasses[size],
        isSelected
          ? "border-primary bg-primary text-primary-foreground shadow-e1"
          : "border-border bg-card text-foreground hover:border-primary/40"
      )}
    >
      {/* Check indicator */}
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded-full transition-all duration-200",
          isSelected
            ? "bg-primary-foreground/25 text-primary-foreground"
            : "bg-muted text-transparent"
        )}
      >
        <Check className="size-2.5" />
      </span>

      {/* Label */}
      <span>{value.value}</span>
      {disabled && <span className="text-xs font-normal">Sin stock</span>}

      {/* Price badge */}
      {value.extraPrice > 0 && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums",
            isSelected
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-primary/10 text-primary"
          )}
        >
          +{money(value.extraPrice)}
        </span>
      )}

      {/* Active ring pulse */}
      {isSelected && !disabled && (
        <span className="absolute inset-0 rounded-full animate-[ringPulse_2s_ease-in-out_infinite] border-2 border-primary/50" />
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
}: {
  option: PosProductOption
  selected: Set<string>
  onToggle: (valueId: string) => void
  showValidation: boolean
}) {
  const isValid = !option.required || selected.size >= option.minSelect
  const activeCount = selected.size
  const maxLabel =
    option.maxSelect > 1
      ? `hasta ${option.maxSelect}`
      : option.required
        ? "1"
        : "0-1"

  return (
    <motion.div className="space-y-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            {option.name}
          </h3>
          {option.required && (
            <Badge variant="destructive" className="text-xs px-1.5 py-0">
              Requerido
            </Badge>
          )}
        </div>
        <span
          className={cn(
            "text-xs font-medium tabular-nums transition-colors",
            isValid ? "text-success-ink" : "text-destructive"
          )}
        >
          {activeCount}/{maxLabel}
        </span>
      </div>
      {option.effectiveRule && (
        <p className="text-xs text-muted-foreground">
          Incluye {option.effectiveRule.included} sin costo
          {option.effectiveRule.overageMode === "blocked"
            ? "; no admite adicionales."
            : option.effectiveRule.overageMode === "fixed"
              ? `; cada elección adicional cuesta ${money(option.effectiveRule.overagePrice)}.`
              : "; las adicionales conservan el precio indicado."}
        </p>
      )}

      {/* Pills grid */}
      <div className="flex flex-wrap gap-2">
        {option.values.map((value) => (
            <OptionPill
              key={value.id}
              value={value}
              isSelected={selected.has(value.id)}
              disabled={!value.isActive}
              onToggle={() => value.isActive && onToggle(value.id)}
            />
          ))}
      </div>
      {option.values.length > 0 && option.values.every((value) => !value.isActive) && (
        <p className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning-ink">
          Este insumo forma parte de la configuración, pero ninguna presentación tiene existencias. No puede seleccionarse por ahora.
        </p>
      )}

      {/* Validation message */}
      {!isValid && showValidation && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <span className="size-1 rounded-full bg-destructive" />
          Selecciona al menos {option.minSelect} {option.name.toLowerCase()}
        </p>
      )}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Notes Input                                                        */
/* ------------------------------------------------------------------ */

function NotesInput({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const presets = [
    "Sin azúcar",
    "Extra crema",
    "Poco cocido",
    "Sin cebolla",
    "Bien cocido",
    "Extra salsa",
  ]

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
        Notas / Modificaciones
      </h3>

      {/* Quick presets */}
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => {
          const isActive = value.toLowerCase().includes(preset.toLowerCase())
          return (
            <button
              key={preset}
              type="button"
              onClick={() => {
                if (isActive) {
                  // Remove preset from notes
                  const regex = new RegExp(`[,;]?\\s*${preset}`, "gi")
                  onChange(value.replace(regex, "").trim())
                } else {
                  onChange(value ? `${value}, ${preset}` : preset)
                }
              }}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-all duration-200 hover:shadow-sm active:scale-95",
                isActive
                  ? "border-warning bg-warning/10 text-warning-ink"
                  : "border-border bg-muted text-muted-foreground hover:border-border"
              )}
            >
              {isActive && <Check className="mr-0.5 inline size-3" />}
              {preset}
            </button>
          )
        })}
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Escribe notas adicionales..."
          className="w-full rounded-2xl border-2 border-border bg-muted px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:outline-none focus:ring-4 focus:ring-success/10"
          rows={2}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-3 top-3 rounded-full bg-muted p-0.5 text-muted-foreground transition-colors hover:bg-muted-foreground/30"
          >
            <X className="size-3" />
          </button>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Quantity Selector                                                  */
/* ------------------------------------------------------------------ */

function QuantitySelector({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border-2 border-border bg-card p-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-all hover:bg-muted/80 active:scale-90"
      >
        <Minus className="size-4" />
      </button>
      <span className="min-w-[3rem] text-center text-lg font-bold tabular-nums">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-all hover:bg-primary/20 active:scale-90"
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main ProductBuilder                                                */
/* ------------------------------------------------------------------ */

export function ProductBuilder({
  product,
  portalProduct,
  open,
  onClose,
  onAdd,
}: ProductBuilderProps) {
  // Normalize: use portalProduct if provided, else POS product
  const activeProduct = portalProduct ?? product ?? null
  const [selections, setSelections] = useState<Map<string, Set<string>>>(
    new Map()
  )
  // Tamaño (variante) elegido — solo relevante en el portal, donde el builder
  // es la única pantalla y la variante no se eligió antes de abrir el panel.
  const [variantId, setVariantId] = useState<string | null>(null)
  const [notes, setNotes] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [showValidation, setShowValidation] = useState(false)

  const portalVariants = portalProduct?.variants ?? []
  const selectedVariant =
    portalVariants.find((v) => v.id === variantId) ?? portalVariants[0] ?? null
  const effectiveVariantId = portalProduct ? selectedVariant?.id : product?.variantId
  const activeOptions = useMemo(
    () => (activeProduct?.options ?? []).filter(
      (option) => !option.appliesToVariantId || option.appliesToVariantId === effectiveVariantId
    ).map((option) => {
      const effectiveRule = optionRuleForVariant(option.variantRules, effectiveVariantId)
      return effectiveRule
        ? { ...option, maxSelect: effectiveRule.maxSelect, effectiveRule }
        : { ...option, effectiveRule: null }
    }),
    [activeProduct, effectiveVariantId]
  )

  const resetSelections = useCallback(() => {
    setSelections(new Map())
    setVariantId(null)
    setNotes("")
    setQuantity(1)
    setShowValidation(false)
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

  const toggleValue = useCallback(
    (option: PosProductOption, valueId: string) => {
      setSelections((prev) => {
        const next = new Map(prev)
        const current = new Set(next.get(option.id) ?? new Set<string>())

        if (current.has(valueId)) {
          // Quitar la selección.
          current.delete(valueId)
        } else if (option.maxSelect <= 1) {
          // Selección única: elegir otro valor reemplaza al anterior.
          current.clear()
          current.add(valueId)
        } else if (current.size < option.maxSelect) {
          current.add(valueId)
        }

        if (current.size === 0) next.delete(option.id)
        else next.set(option.id, current)
        return next
      })
    },
    []
  )

  // Si cambia el producto mientras el panel está abierto, empezar de cero
  // (nunca arrastrar selecciones/notas de un producto anterior).
  useEffect(() => {
    resetSelections()
  }, [activeProduct?.id, resetSelections])

  const totalExtraPrice = useMemo(() => {
    if (!activeProduct) return 0
    let total = 0
    for (const option of activeOptions) {
      const selected = selections.get(option.id) ?? new Set()
      total += calculateOptionExtra(
        option.values.filter((value) => selected.has(value.id)).map((value) => value.extraPrice),
        option.effectiveRule
      )
    }
    return total
  }, [activeProduct, activeOptions, selections])

  const isValid = useMemo(() => {
    if (!activeProduct) return false
    for (const option of activeOptions) {
      if (option.required) {
        const selected = selections.get(option.id) ?? new Set()
        if (selected.size < option.minSelect) return false
      }
    }
    return true
  }, [activeProduct, activeOptions, selections])

  const buildSelectedOptions = useCallback((): SelectedOption[] => {
    if (!activeProduct) return []
    const result: SelectedOption[] = []
    for (const option of activeOptions) {
      const selected = selections.get(option.id) ?? new Set()
      if (selected.size === 0) continue
      const values = option.values
        .filter((v) => selected.has(v.id))
      const charges = calculateOptionValueCharges(values, option.effectiveRule)
      const pricedValues = values.map((v) => ({
          id: v.id,
          value: v.value,
          extraPrice: charges.get(v.id) ?? 0,
        }))
      result.push({
        optionId: option.id,
        optionName: option.name,
        values: pricedValues,
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
      if (!activeProduct || !isValid) {
        setShowValidation(true)
        return
      }
      onAdd({
        product: activeProduct,
        variant: portalProduct ? selectedVariant : null,
        selectedOptions: buildSelectedOptions(),
        totalExtraPrice,
        notes,
        quantity,
      })
      handleClose()
    },
    [
      activeProduct,
      isValid,
      onAdd,
      buildSelectedOptions,
      totalExtraPrice,
      notes,
      quantity,
      handleClose,
      portalProduct,
      selectedVariant,
    ]
  )

  const handleClear = useCallback(() => {
    resetSelections()
  }, [resetSelections])

  if (!activeProduct || activeProduct.options.length === 0) return null

  // Base price: portal usa la variante elegida; POS ya trae su precio propio
  const basePrice = portalProduct
    ? (selectedVariant?.price ?? portalProduct.variants[0]?.price ?? 0)
    : (product?.price ?? 0)
  const finalPrice = basePrice + totalExtraPrice

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-background shadow-e3 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:h-[95dvh] max-md:max-h-[95dvh] max-md:rounded-t-3xl",
          "md:inset-y-0 md:right-0 md:bottom-0 md:left-auto md:w-[520px] md:rounded-l-3xl",
          open
            ? "max-md:translate-y-0 md:translate-x-0"
            : "max-md:translate-y-full md:translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-label={`Configurar ${activeProduct.name}`}
      >
        <div className="mx-auto mt-2 h-1 w-12 shrink-0 rounded-full bg-muted-foreground/30 md:hidden" />
        {/* Header */}
        <div className="relative flex items-center gap-4 border-b border-border px-6 py-4">
          {/* Product image thumbnail */}{" "}
          {activeProduct.imageUrl && (
            <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl border-2 border-border">
              <ThumbImage
                src={activeProduct.imageUrl}
                alt={activeProduct.name}
                className="size-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-foreground dark:text-white">
              {activeProduct.name}
            </h2>
            <p className="text-xs text-muted-foreground">
              Configura tu {activeProduct.name} al gusto
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable options */}
        <ScrollArea className="min-h-0 flex-1 px-4 py-4 sm:px-6 sm:py-5">
          <div className="space-y-6">
            {/* Product hero image (if exists) */}
            {activeProduct.imageUrl && (
              <div className="flex justify-center">
                <div className="relative overflow-hidden rounded-3xl bg-surface-sunken p-6">
                  <ThumbImage
                    src={activeProduct.imageUrl}
                    alt={activeProduct.name}
                    className="h-36 w-36 rounded-2xl object-cover shadow-e2"
                  />
                  <div className="absolute -bottom-2 -right-2 rounded-full bg-primary px-3 py-1 text-sm font-bold text-primary-foreground shadow-e2">
                    <AnimatedPrice value={finalPrice} />
                  </div>
                </div>
              </div>
            )}

            {/* Base price (if no image) */}
            {!activeProduct.imageUrl && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  Precio base
                </p>
                <AnimatedPrice
                  value={basePrice}
                  className="text-2xl font-bold text-foreground dark:text-white"
                />
              </div>
            )}

            {/* Options */}
            {activeOptions.map((option) => {
              const selected = selections.get(option.id) ?? new Set()
              return (
                <OptionSection
                  key={option.id}
                  option={option}
                  selected={selected}
                  onToggle={(valueId) => toggleValue(option, valueId)}
                  showValidation={showValidation}
                />
              )
            })}

            {/* Tamaño (variante) — solo portal: el builder es la única pantalla
                de configuración y la variante no se eligió antes de abrirlo. */}
            {portalProduct && portalVariants.length > 1 && (
              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Tamaño
                </h4>
                <div className="flex flex-wrap items-center gap-2">
                  {portalVariants.map((v) => {
                    const active = selectedVariant?.id === v.id
                    const unavailable =
                      v.isAvailable === false ||
                      (portalProduct.trackInventory && (v.stock ?? 0) <= 0)
                    const diff = v.price - (portalVariants[0]?.price ?? 0)
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={unavailable}
                        onClick={() => setVariantId(v.id)}
                        className={cn(
                          "inline-flex min-h-11 touch-manipulation items-center rounded-xl border px-4 py-2 text-sm font-medium transition-colors active:scale-[0.97]",
                          active
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-card text-foreground hover:border-border",
                          unavailable && "cursor-not-allowed opacity-45"
                        )}
                      >
                        {v.name ?? "Regular"}
                        {unavailable && (
                          <span className="ml-1 text-xs">· Ya no hay</span>
                        )}
                        {diff !== 0 && (
                          <span className="ml-1 text-xs opacity-70">
                            {diff > 0
                              ? `+$${diff.toFixed(2)}`
                              : `-$${Math.abs(diff).toFixed(2)}`}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Notes */}
            <NotesInput value={notes} onChange={setNotes} />

            {/* Selected summary badges */}
            {buildSelectedOptions().length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tu selección
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {buildSelectedOptions().map((opt) =>
                    opt.values.map((v) => (
                      <Badge
                        key={v.id}
                        variant="secondary"
                        className="gap-1 bg-primary/10 text-primary"
                      >
                        {v.value}
                        {v.extraPrice > 0 && (
                          <span className="text-xs">
                            +{money(v.extraPrice)}
                          </span>
                        )}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer — sticky bottom bar */}
        <div className="border-t border-border bg-background/95 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-lg sm:px-6">
          {/* Price breakdown */}
          <div className="mb-3 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Precio base</span>
              <span className="tabular-nums">{money(basePrice)}</span>
            </div>
            {totalExtraPrice > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Extras</span>
                <span className="tabular-nums text-foreground">
                  +{money(totalExtraPrice)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-border pt-1">
              <span className="text-xs text-muted-foreground">Por unidad</span>
              <AnimatedPrice
                value={finalPrice}
                className="text-lg font-bold text-foreground dark:text-white"
              />
            </div>
            {quantity > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Total ({quantity}×)
                </span>
                <AnimatedPrice
                  value={finalPrice * quantity}
                  className="text-2xl font-bold tracking-tight text-foreground"
                />
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <QuantitySelector value={quantity} onChange={setQuantity} />

            <div className="flex flex-1 gap-2">
              <Button
                variant="outline"
                onClick={handleClear}
                className="shrink-0 rounded-full border-border text-muted-foreground hover:bg-muted/80"
              >
                Limpiar
              </Button>
              <Button
                onClick={handleAdd}
                className="flex-1 rounded-full bg-primary text-primary-foreground shadow-e2 transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
              >
                <ShoppingCart className="mr-2 size-4" />
                Agregar
                <AnimatedPrice
                  value={finalPrice * quantity}
                  className="ml-1 text-sm"
                />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Keyframes */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes pricePop {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes ringPulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0; transform: scale(1.05); }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `,
        }}
      />
    </>
  )
}
