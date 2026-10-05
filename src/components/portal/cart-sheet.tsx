"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Minus, Package, Pencil, Plus, ShoppingBag, StickyNote, Trash2 } from "lucide-react"
import { ProductBuilder, selectedOptionsKey } from "@/components/pos/product-builder"
import { portalApi } from "@/lib/portal/client"
import { swalError, swalToast } from "@/lib/swal"
import { usePortalStore, cartSubtotal, cartTax, cartTotal, type PortalCartItem } from "@/stores/portal-store"
import { money, round3, snapToStep } from "@/lib/pos/money"
import { Button } from "@/components/ui/button"
import { BottomSheet } from "@/components/portal/bottom-sheet"
import { CartEmptyIllustration } from "@/components/shared/animated-illustrations"
import { ThumbImage } from "@/components/base/thumb-image"
import { haptic } from "@/lib/haptics"
import { QtyControl } from "@/components/portal/qty-control"
import { cn } from "@/lib/utils"

function CartLine({ item, onEdit }: { item: PortalCartItem; onEdit?: () => void }) {
  const setQty = usePortalStore((s) => s.setQty)
  const removeItem = usePortalStore((s) => s.removeItem)
  const step = item.step > 0 ? item.step : 1
  // Toque en la foto o la descripción: muestra el texto completo.
  const [expanded, setExpanded] = useState(false)
  const change = (delta: number) => {
    haptic.light()
    setQty(item.key, snapToStep(Math.max(step, item.qty + delta), step))
  }

  return (
    <article className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 rounded-2xl border bg-card p-3">
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? `Contraer ${item.name}` : `Ver detalle completo de ${item.name}`}
        onClick={() => setExpanded((v) => !v)}
        className="size-16 self-start overflow-hidden rounded-xl bg-surface-sunken focus-visible:outline-2 focus-visible:outline-primary"
      >
        {item.imageUrl ? <ThumbImage src={item.imageUrl} alt="" className="size-full object-cover" /> : <div className="flex size-full items-center justify-center"><Package className="size-6 text-muted-foreground" /></div>}
      </button>
      <div className="min-w-0">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div role="button" tabIndex={0} aria-expanded={expanded} onClick={() => setExpanded((v) => !v)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded((v) => !v) } }} className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md">
            <h3 className={expanded ? "text-sm font-semibold leading-snug" : "line-clamp-2 text-sm font-semibold leading-snug"}>{item.name}</h3>
            {((item.variantName && item.variantName !== "Default") || item.kind === "bulk") && <p className="mt-0.5 text-xs text-muted-foreground">{item.variantName && item.variantName !== "Default" ? item.variantName : `A granel · ${item.unitAbbrev}`}</p>}
            {item.selectedOptions?.length ? (
              <p className={cn("mt-0.5 text-xs text-primary", !expanded && "line-clamp-2")}>
                {item.selectedOptions.flatMap((o) => o.values.map((v) => v.value)).join(", ")}
                {item.extraPrice ? <span className="font-medium"> +{money(item.extraPrice)}</span> : null}
              </p>
            ) : null}
            {item.comment && (
              <p className={cn("mt-1 flex items-start gap-1 text-xs text-warning-ink", !expanded && "line-clamp-2")}>
                <StickyNote className="mt-0.5 size-3 shrink-0" /> <span>{item.comment}</span>
              </p>
            )}
            </div>
            {onEdit && (
              <button type="button" onClick={onEdit} className="mt-1 inline-flex min-h-8 items-center gap-1 text-xs font-semibold text-primary hover:underline">
                <Pencil className="size-3.5" /> Editar
              </button>
            )}
          </div>
          <button type="button" onClick={() => removeItem(item.key)} aria-label={`Quitar ${item.name}`} className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-2 focus-visible:outline-primary"><Trash2 className="size-4" /></button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold tabular-nums">{money(item.unitPrice * item.qty)}</p>
            <p className="text-xs text-muted-foreground">{money(item.unitPrice)}{item.kind === "bulk" ? `/${item.unitAbbrev}` : " c/u"}</p>
          </div>
          <QtyControl
            value={item.qty}
            step={step}
            max={item.trackInventory ? item.stock : undefined}
            unit={item.kind === "bulk" ? item.unitAbbrev : null}
            label={item.name}
            onChange={(q) => { haptic.light(); setQty(item.key, snapToStep(q, step)) }}
          />
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
  // Editar una línea personalizada: reabre el constructor con sus elecciones.
  const products = usePortalStore((s) => s.products)
  const removeItem = usePortalStore((s) => s.removeItem)
  const addStandard = usePortalStore((s) => s.addStandard)
  const [editing, setEditing] = useState<PortalCartItem | null>(null)
  const editingProduct = editing ? products.find((p) => p.productId === editing.productId) ?? null : null
  const startEdit = async (item: PortalCartItem) => {
    if (!usePortalStore.getState().products.some((p) => p.productId === item.productId)) {
      try {
        const storefront = await portalApi.storefront()
        usePortalStore.getState().setStorefront(storefront.categories, storefront.products)
      } catch {
        swalError("No se pudo abrir el producto", "Revisa tu conexión e intenta de nuevo.")
        return
      }
    }
    setCartOpen(false)
    setEditing(item)
  }

  return (
    <>
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
          <div className="flex items-baseline justify-between border-t border-dashed pt-2.5 font-semibold"><span>Total estimado</span><span className="text-2xl font-bold tracking-tight tabular-nums">{money(total)}</span></div>
        </div>
        <p className="text-xs text-muted-foreground">El envío y las promociones se calculan al finalizar la compra.</p>
        <Button className="h-14 w-full rounded-2xl text-base font-semibold shadow-e2" onClick={() => { setCartOpen(false); router.push("/portal/checkout") }}>Continuar al pago <ArrowRight className="size-4" /></Button>
      </div> : undefined}
    >
      {count === 0 ? <div className="flex flex-col items-center gap-3 py-12 text-center">
        <CartEmptyIllustration />
        <h3 className="font-semibold">Tu carrito está vacío</h3>
        <p className="max-w-60 text-sm text-muted-foreground">Explora la tienda y agrega lo que necesitas.</p>
        <Button variant="outline" className="mt-2 h-11" onClick={() => { setCartOpen(false); router.push("/portal/store") }}><ShoppingBag className="size-4" /> Ir a la tienda</Button>
      </div> : <>
        <div className="flex items-center justify-between gap-2 pb-1"><p className="text-xs text-muted-foreground">Revisa cantidades y productos</p><button type="button" className="text-xs font-semibold text-primary underline-offset-4 hover:underline" onClick={() => setCartOpen(false)}>Seguir comprando</button></div>
        {items.map((item) => (
          <CartLine key={item.key} item={item} onEdit={item.kind === "custom" ? () => void startEdit(item) : undefined} />
        ))}
      </>}
    </BottomSheet>
    {editing && editingProduct && (
      <ProductBuilder
        portalProduct={editingProduct}
        open
        initial={{ variantId: editing.variantId, selectedOptions: editing.selectedOptions, notes: editing.comment, quantity: editing.qty }}
        submitLabel="Actualizar"
        onClose={() => {
          setEditing(null)
          setCartOpen(true)
        }}
        onAdd={(config) => {
          const variant = (config.variant && editingProduct.variants.find((v) => v.id === config.variant!.id)) || editingProduct.variants[0]
          if (!variant) return
          // Reemplaza la línea: se quita la anterior y se agrega la nueva configuración.
          removeItem(editing.key)
          const res = addStandard(editingProduct, variant, config.quantity, config.totalExtraPrice, selectedOptionsKey(config.selectedOptions), config.notes, config.selectedOptions)
          if (res.added <= 0) swalToast("Sin stock disponible", "info")
          else swalToast("Producto actualizado")
          setEditing(null)
          setCartOpen(true)
        }}
      />
    )}
    </>
  )
}
