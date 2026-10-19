"use client"

import { useState } from "react"
import { Plus, UserRound, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cleanGuestName, MAX_GUEST_NAME } from "@/lib/guests"
import { cn } from "@/lib/utils"

// «Pedir para varias personas»: elegir a quién pertenece lo que se agrega o ya
// está en el pedido. Se usa igual en el POS y en el portal del cliente.

/** Fichas con los nombres + «Persona nueva». */
export function GuestPicker({
  names,
  value,
  onChange,
  onAdd,
  allowNone = false,
  className,
}: {
  names: string[]
  value: string | null
  onChange: (name: string | null) => void
  onAdd: (name: string) => void
  /** Permite «Sin asignar». */
  allowNone?: boolean
  className?: string
}) {
  const [adding, setAdding] = useState(names.length === 0)
  const [draft, setDraft] = useState("")

  const commit = () => {
    const name = cleanGuestName(draft)
    if (!name) return
    onAdd(name)
    onChange(name)
    setDraft("")
    setAdding(false)
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div role="radiogroup" aria-label="Persona" className="flex flex-wrap gap-1.5">
        {allowNone && (
          <button
            type="button"
            role="radio"
            aria-checked={value === null}
            onClick={() => onChange(null)}
            className={cn(
              "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition",
              value === null ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/50"
            )}
          >
            Sin asignar
          </button>
        )}
        {names.map((name) => (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={value === name}
            onClick={() => onChange(name)}
            className={cn(
              "inline-flex h-9 max-w-44 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition",
              value === name ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/50"
            )}
          >
            <UserRound className="size-3.5 shrink-0" />
            <span className="truncate">{name}</span>
          </button>
        ))}
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-full border border-dashed px-3 text-sm font-medium text-muted-foreground transition hover:border-primary/50 hover:text-primary"
          >
            <Plus className="size-3.5" /> Persona nueva
          </button>
        )}
      </div>
      {adding && (
        <div className="flex items-center gap-2">
          <Input
            autoFocus={names.length > 0}
            value={draft}
            maxLength={MAX_GUEST_NAME}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                commit()
              }
            }}
            placeholder="Nombre (ej. Juan)"
            aria-label="Nombre de la persona"
            className="h-10"
          />
          <Button type="button" size="sm" onClick={commit} disabled={!cleanGuestName(draft)}>
            Agregar
          </Button>
          {names.length > 0 && (
            <Button type="button" size="icon" variant="ghost" onClick={() => setAdding(false)} aria-label="Cancelar">
              <X className="size-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Barra del modo «varias personas»: interruptor + a quién se está pidiendo ahora.
 * Lo que se agregue mientras está activa se asigna a la persona elegida.
 */
export function GuestModeBar({
  on,
  onToggle,
  names,
  active,
  onSelect,
  onAdd,
  className,
  compact = false,
}: {
  on: boolean
  onToggle: (on: boolean) => void
  names: string[]
  active: string | null
  onSelect: (name: string | null) => void
  onAdd: (name: string) => void
  className?: string
  /** Versión corta para pantallas con poco alto (POS). */
  compact?: boolean
}) {
  return (
    <div className={cn("rounded-2xl border bg-card", compact ? "p-2" : "p-3", on && "border-primary/40 bg-primary/[0.04]", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onToggle(!on)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            <Users className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Pedir para varias personas</span>
            {!compact && (
              <span className="block text-xs text-muted-foreground">
                {on ? "Cada producto lleva el nombre de quién es." : "Separa el pedido por persona para no revolver los platos."}
              </span>
            )}
          </span>
        </span>
        <span aria-hidden className={cn("flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition", on ? "bg-primary" : "bg-muted-foreground/30")}>
          <span className={cn("size-5 rounded-full bg-background shadow transition-transform", on && "translate-x-5")} />
        </span>
      </button>
      {on && (
        <div className={cn("space-y-1.5 border-t", compact ? "mt-2 pt-2" : "mt-3 pt-3")}>
          {!compact && <p className="text-xs font-medium text-muted-foreground">Estoy pidiendo para:</p>}
          <GuestPicker names={names} value={active} onChange={onSelect} onAdd={onAdd} />
        </div>
      )}
    </div>
  )
}
