"use client"

import { useMemo, useState } from "react"
import { Boxes, Minus, Plus, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Reveal } from "@/components/landing/reveal"
import { kitWhatsappUrl, type KitSelection } from "@/lib/whatsapp"
import { cn } from "@/lib/utils"

// «Arma tu Kit POS»: el cliente elige componentes y cantidades y nos escribe por
// WhatsApp con su lista. No se muestran precios: se cotiza al contactarnos.

export interface KitItemPublic {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  options: string[]
}

function Stepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value === 0}
        aria-label={`Quitar uno: ${label}`}
        className="grid size-10 cursor-pointer place-items-center rounded-lg border bg-background transition hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-40 desk:size-8"
      >
        <Minus className="size-4" />
      </button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(99, value + 1))}
        aria-label={`Agregar uno: ${label}`}
        className="grid size-10 cursor-pointer place-items-center rounded-lg border bg-background transition hover:border-primary/50 desk:size-8"
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}

export function KitQuote({ items }: { items: KitItemPublic[] }) {
  // clave = id | opción ("" si el componente no tiene opciones)
  const [qty, setQty] = useState<Record<string, number>>({})
  const set = (key: string, n: number) => setQty((q) => ({ ...q, [key]: n }))

  const selection = useMemo<KitSelection[]>(() => {
    const out: KitSelection[] = []
    for (const item of items) {
      const keys = item.options.length ? item.options : [""]
      for (const option of keys) {
        const n = qty[`${item.id}|${option}`] ?? 0
        if (n > 0) out.push({ name: item.name, option: option || null, quantity: n })
      }
    }
    return out
  }, [items, qty])
  const total = selection.reduce((n, s) => n + s.quantity, 0)

  return (
    <div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, i) => {
          const chosen = (item.options.length ? item.options : [""]).reduce((n, o) => n + (qty[`${item.id}|${o}`] ?? 0), 0)
          return (
            <Reveal key={item.id} delay={(i % 3) * 0.08} className="h-full">
              <div
                className={cn(
                  "flex h-full flex-col overflow-hidden rounded-3xl border bg-card shadow-e1 transition-[border-color,box-shadow] duration-300",
                  chosen > 0 && "border-primary/50 shadow-e3"
                )}
              >
                <div className="aspect-[4/3] bg-muted/50">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.name} loading="lazy" className="size-full object-contain" />
                  ) : (
                    <div className="grid size-full place-items-center text-muted-foreground">
                      <Boxes className="size-10" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <div>
                    <h3 className="font-heading text-lg font-semibold tracking-tight">{item.name}</h3>
                    {item.description && <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>}
                  </div>
                  <div className="mt-auto space-y-2">
                    {(item.options.length ? item.options : [""]).map((option) => (
                      <div key={option || "unico"} className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">{option || "Cantidad"}</span>
                        <Stepper value={qty[`${item.id}|${option}`] ?? 0} onChange={(n) => set(`${item.id}|${option}`, n)} label={option ? `${item.name} (${option})` : item.name} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          )
        })}
      </div>

      <div className="mt-8 flex flex-col items-start gap-3 rounded-3xl border bg-card p-5 shadow-e1 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0">
          <p className="font-heading text-lg font-semibold">
            {total === 0 ? "Elige lo que necesitas" : `${total} ${total === 1 ? "pieza" : "piezas"} en tu cotización`}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {total === 0
              ? "Agrega los componentes con el + y te respondemos con tu cotización."
              : selection.map((s) => `${s.quantity} ${s.option ?? s.name}${s.option ? ` (${s.name})` : ""}`).join(" · ")}
          </p>
        </div>
        {total > 0 ? (
          <Button asChild className="h-12 w-full shrink-0 rounded-xl sm:w-auto desk:h-10">
            <a href={kitWhatsappUrl(selection)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-4" /> Cotizar por WhatsApp
            </a>
          </Button>
        ) : (
          <Button disabled className="h-12 w-full shrink-0 rounded-xl sm:w-auto desk:h-10">
            <MessageCircle className="size-4" /> Cotizar por WhatsApp
          </Button>
        )}
      </div>
    </div>
  )
}
