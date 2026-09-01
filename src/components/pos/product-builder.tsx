"use client"

import { useState, useMemo, useCallback } from "react"
import {
  Check,
  Minus,
  Plus,
  ShoppingCart,
  X,
} from "lucide-react"
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

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SelectedOption {
  optionId: string
  optionName: string
  values: { id: string; value: string; extraPrice: number }[]
}

/** Minimal portal product shape for the builder */
interface PortalProductLike {
  id: string
  name: string
  imageUrl?: string | null
  variants: { id: string; price: number; name?: string }[]
  options: {
    id: string
    name: string
    position: number
    required: boolean
    minSelect: number
    maxSelect: number
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
        className,
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
}: {
  value: PosProductOptionValue
  isSelected: boolean
  onToggle: () => void
  size?: "sm" | "md" | "lg"
}) {
  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-base gap-2.5",
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "relative inline-flex items-center rounded-full border-2 font-medium transition-all duration-200",
        "hover:shadow-md active:scale-95",
        sizeClasses[size],
        isSelected
          ? "border-emerald-600 bg-emerald-600 text-white shadow-lg shadow-emerald-600/25"
          : "border-stone-200 bg-white text-stone-700 hover:border-emerald-300 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200",
      )}
    >
      {/* Check indicator */}
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded-full transition-all duration-200",
          isSelected
            ? "bg-white/25 text-white"
            : "bg-stone-100 text-transparent dark:bg-stone-700",
        )}
      >
        <Check className="size-2.5" />
      </span>

      {/* Label */}
      <span>{value.value}</span>

      {/* Price badge */}
      {value.extraPrice > 0 && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
            isSelected
              ? "bg-white/20 text-white"
              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
          )}
        >
          +{money(value.extraPrice)}
        </span>
      )}

      {/* Active ring pulse */}
      {isSelected && (
        <span className="absolute inset-0 rounded-full animate-[ringPulse_2s_ease-in-out_infinite] border-2 border-emerald-400/50" />
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
    option.maxSelect > 1 ? `hasta ${option.maxSelect}` : option.required ? "1" : "0-1"

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
            {option.name}
          </h3>
          {option.required && (
            <Badge
              variant="destructive"
              className="text-[10px] px-1.5 py-0"
            >
              Requerido
            </Badge>
          )}
        </div>
        <span
          className={cn(
            "text-xs font-medium tabular-nums transition-colors",
            isValid
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-500",
          )}
        >
          {activeCount}/{maxLabel}
        </span>
      </div>

      {/* Pills grid */}
      <div className="flex flex-wrap gap-2">
        {option.values
          .filter((v) => v.isActive)
          .map((value) => (
            <OptionPill
              key={value.id}
              value={value}
              isSelected={selected.has(value.id)}
              onToggle={() => onToggle(value.id)}
            />
          ))}
      </div>

      {/* Validation message */}
      {!isValid && showValidation && (
        <p className="flex items-center gap-1 text-xs text-red-500">
          <span className="size-1 rounded-full bg-red-500" />
          Selecciona al menos {option.minSelect} {option.name.toLowerCase()}
        </p>
      )}
    </div>
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
      <h3 className="text-sm font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
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
                  ? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "border-stone-200 bg-stone-50 text-stone-600 hover:border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400",
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
          className="w-full rounded-2xl border-2 border-stone-200 bg-stone-50 px-4 py-3 text-sm placeholder:text-stone-400 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-400/10 dark:border-stone-700 dark:bg-stone-800 dark:focus:border-emerald-500"
          rows={2}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-3 top-3 rounded-full bg-stone-200 p-0.5 text-stone-500 transition-colors hover:bg-stone-300 dark:bg-stone-600 dark:hover:bg-stone-500"
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
    <div className="inline-flex items-center gap-1 rounded-full border-2 border-stone-200 bg-white p-1 dark:border-stone-700 dark:bg-stone-800">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="flex size-9 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition-all hover:bg-stone-200 active:scale-90 dark:bg-stone-700 dark:text-stone-300"
      >
        <Minus className="size-4" />
      </button>
      <span className="min-w-[3rem] text-center text-lg font-bold tabular-nums">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="flex size-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 transition-all hover:bg-emerald-200 active:scale-90 dark:bg-emerald-900/30 dark:text-emerald-400"
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
    new Map(),
  )
  const [notes, setNotes] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [showValidation, setShowValidation] = useState(false)

  const resetSelections = useCallback(() => {
    setSelections(new Map())
    setNotes("")
    setQuantity(1)
    setShowValidation(false)
  }, [])

  const handleClose = useCallback(() => {
    resetSelections()
    onClose()
  }, [resetSelections, onClose])

  const toggleValue = useCallback(
    (option: PosProductOption, valueId: string) => {
      setSelections((prev) => {
        const next = new Map(prev)
        const current = next.get(option.id) ?? new Set<string>()

        if (current.has(valueId)) {
          current.delete(valueId)
        } else if (current.size < option.maxSelect) {
          current.add(valueId)
        }
        next.set(option.id, current)
        return next
      })
    },
    [],
  )

  const totalExtraPrice = useMemo(() => {
    if (!activeProduct) return 0
    let total = 0
    for (const option of activeProduct.options) {
      const selected = selections.get(option.id) ?? new Set()
      for (const value of option.values) {
        if (selected.has(value.id)) total += value.extraPrice
      }
    }
    return total
  }, [activeProduct, selections])

  const isValid = useMemo(() => {
    if (!activeProduct) return false
    for (const option of activeProduct.options) {
      if (option.required) {
        const selected = selections.get(option.id) ?? new Set()
        if (selected.size < option.minSelect) return false
      }
    }
    return true
  }, [activeProduct, selections])

  const buildSelectedOptions = useCallback((): SelectedOption[] => {
    if (!activeProduct) return []
    const result: SelectedOption[] = []
    for (const option of activeProduct.options) {
      const selected = selections.get(option.id) ?? new Set()
      if (selected.size === 0) continue
      const values = option.values
        .filter((v) => selected.has(v.id))
        .map((v) => ({
          id: v.id,
          value: v.value,
          extraPrice: v.extraPrice,
        }))
      result.push({
        optionId: option.id,
        optionName: option.name,
        values,
      })
    }
    return result
  }, [activeProduct, selections])

  const handleAdd = useCallback(() => {
    if (!product || !isValid) {
      setShowValidation(true)
      return
    }
    onAdd({            product: activeProduct as PosProduct | PortalProductLike,
            selectedOptions: buildSelectedOptions(),
      totalExtraPrice,
      notes,
      quantity,
    })
    handleClose()
  }, [
    product,
    isValid,
    onAdd,
    buildSelectedOptions,
    totalExtraPrice,
    notes,
    quantity,
    handleClose,
  ])

  const handleClear = useCallback(() => {
    resetSelections()
  }, [resetSelections])

  if (!activeProduct || activeProduct.options.length === 0) return null

  // Base price: POS product has .price, portal product has variants[0].price
  const basePrice = portalProduct
    ? (portalProduct.variants[0]?.price ?? 0)
    : (product?.price ?? 0)
  const finalPrice = basePrice + totalExtraPrice

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
          open
            ? "opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] dark:bg-stone-950",
          "max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:max-h-[90vh] max-md:rounded-t-3xl",
          "md:inset-y-0 md:right-0 md:bottom-0 md:left-auto md:w-[520px] md:rounded-l-3xl",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="relative flex items-center gap-4 border-b border-stone-200 px-6 py-4 dark:border-stone-800">
          {/* Product image thumbnail */}            {activeProduct.imageUrl && (
              <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl border-2 border-stone-100 dark:border-stone-800">
                <img
                  src={activeProduct.imageUrl}
                  alt={activeProduct.name}
                className="size-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-stone-900 dark:text-white">
              {activeProduct.name}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Configura tu {activeProduct.name} al gusto
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500 transition-colors hover:bg-stone-200 hover:text-stone-700 dark:bg-stone-800 dark:text-stone-400"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable options */}
        <ScrollArea className="flex-1 px-6 py-5">
          <div className="space-y-6">
            {/* Product hero image (if exists) */}
            {activeProduct.imageUrl && (
              <div className="flex justify-center">
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 p-6 dark:from-emerald-950/30 dark:to-teal-950/30">
                  <img
                    src={activeProduct.imageUrl}
                    alt={activeProduct.name}
                    className="h-36 w-36 rounded-2xl object-cover shadow-xl transition-transform duration-500 hover:scale-110"
                  />
                  <div className="absolute -bottom-2 -right-2 rounded-full bg-emerald-600 px-3 py-1 text-sm font-bold text-white shadow-lg">
                    <AnimatedPrice value={finalPrice} />
                  </div>
                </div>
              </div>
            )}

            {/* Base price (if no image) */}
            {!activeProduct.imageUrl && (
              <div className="text-center">
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Precio base
                </p>
                <AnimatedPrice
                  value={basePrice}
                  className="text-2xl font-bold text-stone-900 dark:text-white"
                />
              </div>
            )}

            {/* Options */}
            {activeProduct.options.map((option) => {
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

            {/* Notes */}
            <NotesInput value={notes} onChange={setNotes} />

            {/* Selected summary badges */}
            {buildSelectedOptions().length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  Tu selección
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {buildSelectedOptions().map((opt) =>
                    opt.values.map((v) => (
                      <Badge
                        key={v.id}
                        variant="secondary"
                        className="gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      >
                        {v.value}
                        {v.extraPrice > 0 && (
                          <span className="text-[10px]">
                            +{money(v.extraPrice)}
                          </span>
                        )}
                      </Badge>
                    )),
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer — sticky bottom bar */}
        <div className="border-t border-stone-200 bg-white/80 px-6 py-4 backdrop-blur-lg dark:border-stone-800 dark:bg-stone-950/80">
          {/* Price breakdown */}
          <div className="mb-3 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-stone-500">Precio base</span>
              <span className="tabular-nums">{money(basePrice)}</span>
            </div>
            {totalExtraPrice > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-500">Extras</span>
                <span className="tabular-nums text-emerald-600">
                  +{money(totalExtraPrice)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-stone-100 pt-1 dark:border-stone-800">
              <span className="text-xs text-stone-500">Por unidad</span>
              <AnimatedPrice
                value={finalPrice}
                className="text-lg font-bold text-stone-900 dark:text-white"
              />
            </div>
            {quantity > 1 && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-600">
                  Total ({quantity}×)
                </span>
                <AnimatedPrice
                  value={finalPrice * quantity}
                  className="text-xl font-bold text-emerald-600"
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
                className="shrink-0 rounded-full border-stone-200 text-stone-600 hover:bg-stone-50 dark:border-stone-700"
              >
                Limpiar
              </Button>
              <Button
                onClick={handleAdd}
                disabled={!isValid}
                className="flex-1 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-700 hover:shadow-xl hover:shadow-emerald-600/30 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
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
      <style dangerouslySetInnerHTML={{ __html: `
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
      ` }} />
    </>
  )
}
