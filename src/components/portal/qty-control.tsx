"use client"

import { useState } from "react"
import { Minus, Plus, Trash2 } from "lucide-react"
import { round3 } from "@/lib/pos/money"
import { cn } from "@/lib/utils"

/**
 * Selector de cantidad del portal (mismo patrón que el ticket del POS): − y +
 * avanzan de `step` en `step`; tocar la cantidad permite escribirla (50 piezas,
 * 1.35 kg…). Con la cantidad mínima, el «−» se vuelve papelera si hay `onRemove`.
 */
export function QtyControl({
  value,
  step = 1,
  min,
  max,
  unit,
  label,
  onChange,
  onRemove,
  className,
}: {
  value: number
  step?: number
  /** Cantidad mínima (por defecto, un paso). */
  min?: number
  /** Tope (existencia). */
  max?: number
  unit?: string | null
  /** Nombre del artículo, para lectores de pantalla. */
  label: string
  onChange: (qty: number) => void
  onRemove?: () => void
  className?: string
}) {
  const low = min ?? step
  const decimals = step < 1 || !Number.isInteger(value)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")

  const clamp = (n: number) => {
    let next = Math.max(low, round3(n))
    if (max != null && Number.isFinite(max) && next > max) next = Math.max(low, max)
    return next
  }

  const commit = () => {
    setEditing(false)
    const typed = Number(draft.replace(",", "."))
    if (!Number.isFinite(typed) || typed <= 0) return
    // Piezas enteras: sin decimales.
    const next = clamp(decimals ? typed : Math.floor(typed))
    if (next !== value) onChange(next)
  }

  const atMin = value <= low
  const btn =
    "flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-lg transition hover:bg-background active:scale-95 disabled:opacity-35"

  return (
    <div className={cn("inline-flex items-center rounded-xl bg-muted p-0.5", className)} role="group" aria-label={`Cantidad de ${label}`}>
      <button
        type="button"
        className={cn(btn, atMin && onRemove && "text-destructive")}
        disabled={atMin && !onRemove}
        aria-label={atMin && onRemove ? `Quitar ${label}` : `Reducir ${label}`}
        onClick={() => (atMin && onRemove ? onRemove() : onChange(clamp(value - step)))}
      >
        {atMin && onRemove ? <Trash2 className="size-4" /> : <Minus className="size-4" />}
      </button>
      {editing ? (
        <input
          autoFocus
          inputMode={decimals ? "decimal" : "numeric"}
          value={draft}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setDraft(e.target.value.replace(decimals ? /[^\d.,]/g : /[^\d]/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur()
            if (e.key === "Escape") setEditing(false)
          }}
          aria-label={`Escribir la cantidad de ${label}`}
          className="h-11 w-16 rounded-md border border-primary bg-background text-center text-base font-semibold tabular-nums outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft(String(round3(value)))
            setEditing(true)
          }}
          className="h-11 min-w-12 touch-manipulation rounded-md px-1.5 text-center text-sm font-semibold tabular-nums hover:bg-background"
          aria-label={`${round3(value)} de ${label}. Toca para escribir la cantidad`}
        >
          {round3(value)}
          {unit ? <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span> : null}
        </button>
      )}
      <button
        type="button"
        className={btn}
        disabled={max != null && value >= max}
        aria-label={`Aumentar ${label}`}
        onClick={() => onChange(clamp(value + step))}
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}
