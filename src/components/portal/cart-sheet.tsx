"use client"

import { useRouter } from "next/navigation"
import { ArrowRight, Minus, Package, Plus, ShoppingBag, Trash2 } from "lucide-react"
import { usePortalStore, cartSubtotal, cartTax, cartTotal, type PortalCartItem } from "@/stores/portal-store"
import { money, round3, snapToStep } from "@/lib/pos/money"
import { Button } from "@/components/ui/button"
import { BottomSheet } from "@/components/portal/bottom-sheet"
import { CartEmptyIllustration } from "@/components/shared/animated-illustrations"
import { ThumbImage } from "@/components/base/thumb-image"
import { haptic } from "@/lib/haptics"

function CartLine({ item }: { item: PortalCartItem }) {
  const setQty = usePortalStore((s) => s.setQty)
  const removeItem = usePortalStore((s) => s.removeItem)
  const step = item.step > 0 ? item.step : 1
  const change = (delta: number) => {
    haptic.light()
    setQty(item.key, snapToStep(Math.max(step, item.qty + delta), step))
  }

  return (
    <article className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 rounded-2xl border bg-card p-3 shadow-sm">
      <div className="size-14 overflow-hidden rounded-xl bg-muted">
        {item.imageUrl ? <ThumbImage src={item.imageUrl} alt="" className="size-full object-cover" /> : <div className="flex size-full items-center justify-center"><Package className="size-6 text-muted-foreground" /></div>}
      </div>
      <div className="min-w-0">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{item.name}</h3>
            {(item.variantName || item.kind === "bulk") && <p className="mt-0.5 text-xs text-muted-foreground">{item.variantName || `A granel · ${item.unitAbbrev}`}</p>}
            {item.comment && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.comment}</p>}
          </div>
          <button type="button" onClick={() => removeItem(item.key)} aria-label={`Quitar ${item.name}`} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-2 focus-visible:outline-primary"><Trash2 className="size-4" /></button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold tabular-nums">{money(item.unitPrice * item.qty)}</p>
            <p className="text-xs text-muted-foreground">{money(item.unitPrice)}{item.kind === "bulk" ? `/${item.unitAbbrev}` : " c/u"}</p>
          </div>
          <div className="flex items-center rounded-xl border bg-background" aria-label={`Cantidad de ${item.name}`}>
            <button type="button" onClick={() => change(-step)} disabled={item.qty <= step} aria-label={`Reducir ${item.name}`} className="flex size-11 items-center justify-center rounded-l-xl disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary"><Minus className="size-4" /></button>
            <span className="min-w-12 text-center text-sm font-semibold tabular-nums">{round3(item.qty)}</span>
            <button type="button" onClick={() => change(step)} disabled={item.trackInventory && item.qty >= item.stock} aria-label={`Aumentar ${item.name}`} className="flex size-11 items-center justify-center rounded-r-xl disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary"><Plus className="size-4" /></button>
          </div>
        </div>
      </div>
    </article>
  )
}

export function CartSheet() {
  const router = useRouter()
  const open = usePortalStore((s) => s.cartOpen)
  const setCartOpen = usePortalStore((s) => s.setCartOpen)
  const items = usePortalStore((s) => s.items)
  const subtotal = cartSubtotal(items)
  const tax = cartTax(items)
  const total = cartTotal(items)
  const count = items.length

  return (
    <BottomSheet
      open={open}
      onOpenChange={setCartOpen}
      title="Tu carrito"
      description={count ? `${count} producto${count === 1 ? "" : "s"} para revisar antes de pagar` : "Todavía no agregas productos"}
      className="sm:max-w-xl"
      height="auto"
      maxHeight="88dvh"
      bodyClassName="space-y-3"
      footer={count > 0 ? <div className="w-full space-y-3">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">{money(subtotal)}</span></div>
          {tax > 0 && <div className="flex justify-between text-muted-foreground"><span>Impuestos</span><span className="tabular-nums">{money(tax)}</span></div>}
          <div className="flex justify-between border-t pt-2 text-base font-semibold"><span>Total estimado</span><span className="tabular-nums">{money(total)}</span></div>
        </div>
        <p className="text-xs text-muted-foreground">El envío y las promociones se calculan al finalizar la compra.</p>
        <Button className="h-12 w-full rounded-xl" onClick={() => { setCartOpen(false); router.push("/portal/checkout") }}>Continuar al pago <ArrowRight className="size-4" /></Button>
      </div> : undefined}
    >
      {count === 0 ? <div className="flex flex-col items-center gap-3 py-12 text-center">
        <CartEmptyIllustration />
        <h3 className="font-semibold">Tu carrito está vacío</h3>
        <p className="max-w-60 text-sm text-muted-foreground">Explora la tienda y agrega lo que necesitas.</p>
        <Button variant="outline" className="mt-2 h-11" onClick={() => { setCartOpen(false); router.push("/portal/store") }}><ShoppingBag className="size-4" /> Ir a la tienda</Button>
      </div> : <>
        <div className="flex items-center justify-between gap-2 pb-1"><p className="text-xs text-muted-foreground">Revisa cantidades y productos</p><button type="button" className="text-xs font-semibold text-primary underline-offset-4 hover:underline" onClick={() => setCartOpen(false)}>Seguir comprando</button></div>
        {items.map((item) => <CartLine key={item.key} item={item} />)}
      </>}
    </BottomSheet>
  )
}
