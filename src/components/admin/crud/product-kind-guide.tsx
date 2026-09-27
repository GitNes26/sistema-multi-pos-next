"use client"

import { CalendarClock, ChefHat, Layers, Package, Scale, Sparkles, SlidersHorizontal, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// Selector de "¿Qué vas a vender?" con explicación de cada tipo.
// "Servicio" no es un tipo en la base de datos: es un producto estándar que
// no controla inventario (así lo reconoce la agenda para reservar citas).

export type ProductKind = "standard" | "bulk" | "custom" | "service"

const KINDS: { value: ProductKind; label: string; icon: LucideIcon; short: string; what: string; can: string[]; example: string }[] = [
  {
    value: "standard",
    label: "Producto",
    icon: Package,
    short: "Se vende por pieza",
    what: "Artículo que se cuenta por pieza y lleva existencias.",
    can: ["Código de barras y SKU", "Variantes (talla, color, presentación)", "Mínimos y pedidos sugeridos al proveedor"],
    example: "Refresco 600 ml, playera talla M, cuaderno",
  },
  {
    value: "bulk",
    label: "A granel",
    icon: Scale,
    short: "Se vende por peso o medida",
    what: "Se cobra por kilo, litro o metro; el precio se calcula con la cantidad.",
    can: ["Lectura directa de báscula en el POS", "Venta por cantidad o por monto ($)", "Venta fraccionada (p. ej. por pieza)"],
    example: "Frijol por kilo, jamón rebanado, cable por metro",
  },
  {
    value: "custom",
    label: "Personalizado",
    icon: SlidersHorizontal,
    short: "El cliente lo arma",
    what: "El cliente elige versión y extras al pedir; se abre un constructor en POS y portal.",
    can: ["Variantes con precio propio", "Tópicos: extras y elecciones", "Receta para descontar insumos"],
    example: "Frappé, pizza, hamburguesa, paquete de uñas",
  },
  {
    value: "service",
    label: "Servicio",
    icon: CalendarClock,
    short: "Trabajo o tiempo, sin existencias",
    what: "No se cuenta en inventario. Se cobra en el POS y, si tu negocio usa Agenda, se puede reservar.",
    can: [
      "Se cobra en el POS como cualquier producto, sin pedir existencias",
      "En Agenda, abre un empleado → «Servicios» y asígnale este servicio con su duración para que se pueda reservar",
      "Variantes para versiones con otro precio (corte / corte + barba)",
      "Si consume insumos (p. ej. tinte, pestañas), créalo como «Personalizado» para usar receta",
    ],
    example: "Corte de cabello, lavado de auto, consulta, renta de mesa",
  },
]

export function ProductKindPicker({ value, onChange, showCustom }: { value: ProductKind; onChange: (v: ProductKind) => void; showCustom: boolean }) {
  const list = KINDS.filter((k) => showCustom || k.value !== "custom")
  const active = KINDS.find((k) => k.value === value) ?? KINDS[0]
  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="¿Qué vas a vender?" className={cn("grid gap-2", list.length === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-3")}>
        {list.map((k) => {
          const selected = k.value === value
          return (
            <button
              key={k.value}
              id={k.value === "standard" ? "product-productType" : undefined}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(k.value)}
              className={cn(
                "press flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition",
                selected ? "border-primary bg-primary/10 ring-2 ring-primary/30" : "hover:bg-muted/60"
              )}
            >
              <k.icon className={cn("size-5", selected ? "text-primary" : "text-muted-foreground")} />
              <span className="text-sm font-semibold">{k.label}</span>
              <span className="text-xs text-muted-foreground">{k.short}</span>
            </button>
          )
        })}
      </div>
      <div className="rounded-xl border bg-muted/30 p-3 text-sm">
        <p className="font-medium">{active.what}</p>
        <ul className="mt-1.5 grid gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-2">
          {active.can.map((c) => (
            <li key={c} className="flex gap-1.5">
              <span className="text-primary">✓</span>
              {c}
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Ejemplos:</span> {active.example}
        </p>
      </div>
    </div>
  )
}

/** Guía para el producto personalizado: cuándo usar variante, tópico o receta. */
export function CustomProductGuide() {
  const cols: { icon: LucideIcon; title: string; when: string; rule: string; example: string }[] = [
    {
      icon: Layers,
      title: "1 · Variante",
      when: "Versiones distintas del producto, cada una con su propio precio. El cliente elige solo una.",
      rule: "Úsala si cambia el precio base o el tamaño.",
      example: "Chico $45 · Mediano $55 · Grande $65",
    },
    {
      icon: Sparkles,
      title: "2 · Tópicos",
      when: "Elecciones o extras sobre la variante elegida. Pueden ser obligatorios, con mínimo/máximo y costo extra.",
      rule: "Úsalo si el cliente agrega o escoge algo.",
      example: "Leche: entera / deslactosada (+$8) · Extras: chispas (+$5)",
    },
    {
      icon: ChefHat,
      title: "3 · Receta",
      when: "Lo que se gasta del inventario al venderlo. El cliente no la ve. Puede ser distinta por variante.",
      rule: "Úsala para descontar insumos y conocer tu costo real.",
      example: "Grande: vaso 16 oz, 30 g de café, 250 ml de leche",
    },
  ]
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <p className="text-sm font-medium">¿Variante, tópico o receta? Se usan juntos, en este orden:</p>
      <div className="mt-2 grid gap-2 md:grid-cols-3">
        {cols.map((c) => (
          <div key={c.title} className="rounded-lg border bg-background p-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <c.icon className="size-4 text-primary" /> {c.title}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{c.when}</p>
            <p className="mt-1.5 text-xs font-medium">{c.rule}</p>
            <p className="mt-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">{c.example}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Pasos: guarda el producto → define variantes aquí abajo → agrega tópicos → desde la tabla abre «Receta e insumos» para cada variante.
        Si no necesitas versiones, deja solo la variante base.
      </p>
    </div>
  )
}
