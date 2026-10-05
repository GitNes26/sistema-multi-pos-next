"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, ListChecks, Loader2, Package, Plus } from "lucide-react"
import { portalApi } from "@/lib/portal/client"
import type { PortalProduct, ShoppingListView } from "@/lib/portal/server"
import { money } from "@/lib/pos/money"
import { swalError } from "@/lib/swal"
import { Button } from "@/components/ui/button"
import { ThumbImage } from "@/components/base/thumb-image"
import { QtyControl } from "@/components/portal/qty-control"
import { itemKey, toDraft, toPayload, type DraftItem } from "@/components/portal/list-draft"

/**
 * Armado de una lista de compras dentro de la tienda: mismos productos y
 * filtros, pero cada opción se agrega a la LISTA (no al carrito) y la cantidad
 * se ajusta ahí mismo. Se guarda sola; «Listo» regresa a la lista.
 */
export function useListMode(listId: string | null) {
  const [list, setList] = useState<ShoppingListView | null>(null)
  const [items, setItems] = useState<DraftItem[]>([])
  const [saving, setSaving] = useState(false)
  const latest = useRef<{ list: ShoppingListView | null; items: DraftItem[] }>({ list: null, items: [] })
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirty = useRef(false)

  latest.current = { list, items }

  useEffect(() => {
    if (!listId) return
    let alive = true
    portalApi
      .list(listId)
      .then((d) => {
        if (!alive) return
        setList(d.list)
        setItems(d.list.items.map(toDraft))
      })
      .catch((e) => swalError("No se pudo abrir la lista", e instanceof Error ? e.message : undefined))
    return () => {
      alive = false
    }
  }, [listId])

  const flush = useCallback(async () => {
    const { list: l, items: it } = latest.current
    if (!listId || !l || !dirty.current) return true
    setSaving(true)
    try {
      const res = await portalApi.updateList(listId, { name: l.name, notes: l.notes, items: toPayload(it) })
      dirty.current = false
      setList(res.list)
      return true
    } catch (e) {
      swalError("No se pudo guardar la lista", e instanceof Error ? e.message : undefined)
      return false
    } finally {
      setSaving(false)
    }
  }, [listId])

  const schedule = useCallback(() => {
    dirty.current = true
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), 700)
  }, [flush])

  // Al salir de la tienda se guarda lo pendiente.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
      if (dirty.current) void flush()
    },
    [flush]
  )

  const setQty = (key: string, qty: number) => {
    setItems((prev) => prev.map((i) => (itemKey(i) === key ? { ...i, quantity: qty } : i)))
    schedule()
  }
  const add = (item: DraftItem) => {
    setItems((prev) => (prev.some((i) => itemKey(i) === itemKey(item)) ? prev : [...prev, item]))
    schedule()
  }
  const remove = (key: string) => {
    setItems((prev) => prev.filter((i) => itemKey(i) !== key))
    schedule()
  }

  return { list, items, saving, add, setQty, remove, flush }
}

export type ListMode = ReturnType<typeof useListMode>

/** Barra fija con el contexto: a qué lista se agrega, cuántos productos y cómo terminar. */
export function ListModeBanner({ mode, listId }: { mode: ListMode; listId: string }) {
  const router = useRouter()
  const [leaving, setLeaving] = useState(false)
  const total = mode.items.reduce((a, i) => a + i.price * i.quantity, 0)
  return (
    <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 -mx-4 border-b border-primary/30 bg-primary/10 px-4 py-3 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <ListChecks className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Armando «{mode.list?.name ?? "tu lista"}»</p>
          <p className="text-xs text-muted-foreground">
            {mode.items.length} producto{mode.items.length === 1 ? "" : "s"} · {money(total)} estimado{mode.saving ? " · guardando…" : ""}
          </p>
        </div>
        <Button
          className="h-11 shrink-0"
          disabled={leaving}
          onClick={async () => {
            setLeaving(true)
            if (await mode.flush()) router.push(`/portal/lists/${listId}`)
            else setLeaving(false)
          }}
        >
          {leaving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Listo
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Elige la presentación y toca «Agregar». Ajusta la cantidad con − y + o tócala para escribirla. Estos productos van a la lista, no al carrito.</p>
    </div>
  )
}

/** Tarjeta de producto en modo lista: foto, nombre y una fila por presentación con su control. */
export function ListModeCard({ product, mode }: { product: PortalProduct; mode: ListMode }) {
  const units =
    product.kind === "bulk" && product.bulk
      ? [
          { unitId: product.bulk.unitId, unitName: product.bulk.unitName, unitAbbrev: product.bulk.unitAbbrev, price: product.bulk.price, step: product.bulk.step || 0.01, quantity: Math.max(product.bulk.minQty, product.bulk.step || 0.01) },
          ...(product.bulk.split ? [{ ...product.bulk.split, step: 1, quantity: 1 }] : []),
        ]
      : []
  const rows: { key: string; label: string; price: number; suffix: string; make: () => DraftItem; step: number; unit: string | null }[] = [
    ...units.map((u) => ({
      key: `b:${product.productId}:${u.unitId}`,
      label: u.unitName,
      price: u.price,
      suffix: `/${u.unitAbbrev}`,
      step: u.step,
      unit: u.unitAbbrev,
      make: () => ({ productId: product.productId, variantId: null, unitId: u.unitId, unitAbbrev: u.unitAbbrev, step: u.step, productName: product.name, variantName: u.unitName, price: u.price, quantity: u.quantity }),
    })),
    ...(product.kind === "bulk"
      ? []
      : product.variants.map((v) => ({
          key: `v:${v.id}`,
          label: product.variants.length > 1 ? v.name : "Agregar",
          price: v.price,
          suffix: "",
          step: 1,
          unit: null,
          make: () => ({ productId: product.productId, variantId: v.id, unitId: null, unitAbbrev: null, step: 1, productName: product.name, variantName: v.name === "Estándar" || v.name === "Default" ? null : v.name, price: v.price, quantity: 1 }),
        }))),
  ]
  return (
    <li className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex gap-3 p-3">
        <span className="size-20 shrink-0 overflow-hidden rounded-xl bg-muted">
          {product.imageUrl ? <ThumbImage src={product.imageUrl} alt="" className="size-full object-cover" /> : <span className="flex size-full items-center justify-center text-muted-foreground/50"><Package className="size-6" /></span>}
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug">{product.name}</p>
          {product.categoryName && <p className="text-xs text-muted-foreground">{product.categoryName}</p>}
          {product.options && product.options.length > 0 && <p className="mt-1 text-xs text-warning-ink">Producto personalizable: se agrega en su presentación base.</p>}
        </div>
      </div>
      <ul className="divide-y border-t">
        {rows.map((r) => {
          const inList = mode.items.find((i) => itemKey(i) === r.key)
          return (
            <li key={r.key} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0 text-sm">
                {rows.length > 1 || r.label !== "Agregar" ? <span className="block truncate font-medium">{r.label}</span> : null}
                <span className="block text-xs tabular-nums text-muted-foreground">{money(r.price)}{r.suffix}</span>
              </span>
              {inList ? (
                <QtyControl value={inList.quantity} step={r.step} unit={r.unit} label={`${product.name} ${r.label}`} onChange={(q) => mode.setQty(r.key, q)} onRemove={() => mode.remove(r.key)} />
              ) : (
                <Button variant="outline" className="h-11" onClick={() => mode.add(r.make())}>
                  <Plus className="size-4" /> Agregar
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </li>
  )
}
