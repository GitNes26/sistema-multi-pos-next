import { Check, Clock, Package, Scale, ScanBarcode, ShoppingBag, Truck } from "lucide-react"
import { cn } from "@/lib/utils"

// Composición ilustrativa del producto en uso (POS en tablet + portal en
// teléfono), construida con los mismos tokens del sistema: se adapta al tema
// claro/oscuro y al color de la empresa. Es decorativa: aria-hidden.

const PRODUCTS = [
  { name: "Frijol negro", price: "$32.00", unit: "/kg", bulk: true },
  { name: "Café de olla 1 kg", price: "$189.00" },
  { name: "Tortilla de maíz", price: "$24.00", unit: "/kg", bulk: true },
  { name: "Aceite 900 ml", price: "$46.50" },
  { name: "Azúcar estándar", price: "$28.00", unit: "/kg", bulk: true },
  { name: "Galletas surtidas", price: "$38.00" },
]

function PosTablet({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[1.4rem] border bg-background shadow-e3 ring-8 ring-foreground/[0.04]", className)}>
      <div className="flex items-center gap-2 border-b bg-sidebar px-3 py-2">
        <span className="size-2 rounded-full bg-success" />
        <span className="text-[0.7rem] font-semibold">Caja 1 · Sucursal Centro</span>
        <span className="ml-auto flex items-center gap-1 rounded-md border bg-card px-2 py-0.5 text-[0.65rem] text-muted-foreground">
          <ScanBarcode className="size-3" /> Escanear
        </span>
      </div>
      <div className="grid grid-cols-[1fr_9.5rem] sm:grid-cols-[1fr_11rem]">
        <div className="grid grid-cols-2 content-start gap-1.5 p-2 sm:grid-cols-3">
          {PRODUCTS.map((p, i) => (
            <div
              key={p.name}
              className={cn(
                "flex flex-col gap-1 rounded-lg border bg-card p-1.5",
                i === 0 && "border-primary ring-1 ring-primary",
                i > 3 && "max-sm:hidden"
              )}
            >
              <div className="relative flex h-9 items-center justify-center rounded-md bg-surface-sunken text-muted-foreground">
                <Package className="size-3.5" />
                {p.bulk && (
                  <span className="absolute top-1 left-1 flex items-center gap-0.5 rounded bg-foreground/85 px-1 text-[0.5rem] font-semibold text-background">
                    <Scale className="size-2" /> Granel
                  </span>
                )}
              </div>
              <span className="truncate text-[0.6rem] font-medium">{p.name}</span>
              <span className="text-[0.7rem] font-bold tabular">
                {p.price}
                {p.unit && <span className="text-[0.55rem] font-medium text-muted-foreground">{p.unit}</span>}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-col border-l bg-card">
          <p className="border-b px-2.5 py-1.5 text-[0.65rem] font-semibold">Ticket</p>
          <div className="flex-1 space-y-1.5 p-2">
            {[
              ["Frijol negro", "1.250 kg", "$40.00"],
              ["Café de olla 1 kg", "2", "$378.00"],
              ["Aceite 900 ml", "1", "$46.50"],
            ].map(([n, q, t]) => (
              <div key={n} className="rounded-md border p-1.5">
                <p className="truncate text-[0.6rem] font-medium">{n}</p>
                <p className="flex justify-between text-[0.55rem] text-muted-foreground tabular">
                  <span>{q}</span>
                  <span className="font-semibold text-foreground">{t}</span>
                </p>
              </div>
            ))}
          </div>
          <div className="space-y-1.5 border-t p-2">
            <p className="flex items-baseline justify-between text-[0.6rem]">
              <span>Total</span>
              <span className="text-sm font-bold tabular">$464.50</span>
            </p>
            <span className="flex h-6 items-center justify-between rounded-md bg-primary px-2 text-[0.6rem] font-semibold text-primary-foreground">
              Cobrar <span className="tabular">$464.50</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function PortalPhone({ className }: { className?: string }) {
  return (
    <div className={cn("w-44 overflow-hidden rounded-[1.8rem] border-[5px] border-foreground/90 bg-background shadow-e3", className)}>
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <span className="text-[0.65rem] font-semibold">Mi pedido</span>
        <ShoppingBag className="size-3 text-muted-foreground" />
      </div>
      <div className="space-y-2 px-2.5 pb-2.5">
        <div className="rounded-xl bg-primary p-2.5 text-primary-foreground">
          <p className="text-[0.55rem] opacity-85">Pedido #1042</p>
          <p className="text-xs font-semibold">Va en camino</p>
          <p className="mt-1 flex items-center gap-1 text-[0.55rem] opacity-85">
            <Clock className="size-2.5" /> Llega en 12 min
          </p>
        </div>
        <ol className="space-y-1.5">
          {[
            ["Confirmado", true],
            ["Preparado", true],
            ["En camino", true],
            ["Entregado", false],
          ].map(([label, done], i, arr) => (
            <li key={label as string} className="relative flex items-center gap-1.5">
              {i < arr.length - 1 && (
                <span className={cn("absolute top-3 left-[0.3rem] h-2.5 w-px", done ? "bg-primary" : "bg-border")} />
              )}
              <span
                className={cn(
                  "flex size-2.5 items-center justify-center rounded-full",
                  done ? "bg-primary text-primary-foreground" : "border border-border bg-card"
                )}
              >
                {done && <Check className="size-1.5" strokeWidth={4} />}
              </span>
              <span className={cn("text-[0.6rem]", i === 2 ? "font-semibold" : "text-muted-foreground")}>
                {label as string}
              </span>
              {i === 2 && <Truck className="ml-auto size-3 text-primary" />}
            </li>
          ))}
        </ol>
        <div className="rounded-lg border bg-card p-1.5 text-[0.55rem]">
          <p className="text-muted-foreground">Tus puntos</p>
          <p className="text-xs font-bold tabular">1,280 pts</p>
        </div>
      </div>
    </div>
  )
}

export function ProductShot() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[34rem] select-none">
      <PosTablet className="w-full" />
      <PortalPhone className="absolute -bottom-12 -left-10 hidden sm:block" />
    </div>
  )
}
