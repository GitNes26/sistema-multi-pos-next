"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePosStore } from "@/stores/pos-store"
import { rebuildKitchenLines, type KitchenOrderItemDto } from "@/lib/pos/kitchen-ticket"
import { money } from "@/lib/pos/money"
import { swalToast } from "@/lib/swal"

interface CartLine {
  key: string
  productId: string
  variantId: string | null
  name: string
  quantity: number
  unitPrice: number
  extraPrice: number
  options: { optionName: string; value: string; extraPrice: number }[]
  notes: string
}

/**
 * Carrito que los comensales arman desde el QR de la mesa. El cajero lo ve en vivo y, con un
 * toque, lo pasa al ticket para enviarlo a cocina (o lo descarta).
 */
export function TableCartBanner({ tableId }: { tableId: string }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/pos/kitchen?tableId=${tableId}`, { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      setLines(data.ok ? ((data.cart ?? []) as CartLine[]) : [])
    } catch {
      /* sin conexión */
    }
  }, [tableId])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 5000)
    return () => clearInterval(t)
  }, [load])

  if (lines.length === 0) return null
  const count = lines.reduce((s, l) => s + l.quantity, 0)
  const total = Math.round(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0) * 100) / 100

  const bringToTicket = async () => {
    setBusy(true)
    try {
      const dto: KitchenOrderItemDto[] = lines.map((l) => ({
        id: l.key,
        productId: l.productId,
        variantId: l.variantId,
        productName: l.name,
        quantity: l.quantity,
        unitPrice: l.unitPrice - l.extraPrice,
        unitId: null,
        comment: l.notes || null,
        selectedOptions: l.options,
        extraPrice: l.extraPrice,
        bulkQuantityDisplay: null,
      }))
      // Entran como líneas SIN enviar: el cajero decide cuándo mandarlas a cocina.
      const built = rebuildKitchenLines(dto, usePosStore.getState().products).map((i) => ({ ...i, key: `qr-${i.key}-${Date.now()}`, sentQty: 0 }))
      usePosStore.setState((s) => ({ items: [...s.items, ...built] }))
      await fetch(`/api/pos/kitchen/cart?tableId=${tableId}`, { method: "DELETE" })
      setLines([])
      swalToast(`Se agregaron ${count} ${count === 1 ? "artículo" : "artículos"} del carrito del cliente al ticket`, "info")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-3">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <QrCode className="size-4 text-primary" /> Carrito del cliente (menú QR)
        <span className="ml-auto tabular-nums">{money(total)}</span>
      </p>
      <ul className="space-y-0.5 text-xs text-muted-foreground">
        {lines.map((l) => (
          <li key={l.key} className="flex justify-between gap-2">
            <span className="truncate">
              {l.quantity}× {l.name}
              {l.options.length ? ` · ${l.options.map((o) => o.value).join(", ")}` : ""}
            </span>
            <span className="tabular-nums">{money(l.unitPrice * l.quantity)}</span>
          </li>
        ))}
      </ul>
      <Button className="h-11 w-full gap-2" onClick={() => void bringToTicket()} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : null} Agregar al ticket
      </Button>
    </div>
  )
}
