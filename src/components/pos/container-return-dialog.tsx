"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Minus, Plus, Recycle } from "lucide-react"
import { swalToast } from "@/lib/swal"
import { DialogComponent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { TooltipButton } from "@/components/shared/tooltip-button"
import { usePosStore } from "@/stores/pos-store"
import { money } from "@/lib/pos/money"

interface Balance {
  productId: string
  productName: string
  unitAmount: number
  outstanding: number
  paid: number
  unpaid: number
  amount: number
}

/**
 * «Recibir envase»: el cliente devuelve envases y se le regresa su importe en efectivo (sale de la caja
 * y queda en el corte). Solo aparece si el catálogo tiene productos con importe de envase.
 */
export function ContainerReturnButton() {
  const hasDeposits = usePosStore((s) => s.products.some((p) => (p.depositAmount ?? 0) > 0))
  const locationId = usePosStore((s) => s.location.id)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [balances, setBalances] = useState<Balance[]>([])
  const [qty, setQty] = useState<Record<string, number>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/pos/containers?locationId=${encodeURIComponent(locationId)}`, { cache: "no-store", credentials: "include" })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudieron cargar los envases")
      setBalances(data.balances ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los envases")
    } finally {
      setLoading(false)
    }
  }, [locationId])

  useEffect(() => {
    if (open) {
      setQty({})
      void load()
    }
  }, [open, load])

  if (!hasDeposits) return null

  const writeOff = async (balance: Balance) => {
    const quantity = Math.min(balance.outstanding, Math.max(1, qty[balance.productId] ?? 1))
    const retained = Math.min(quantity, balance.paid) * balance.unitAmount
    const ok = window.confirm(
      `¿Dar de baja ${quantity} envase(s) de ${balance.productName}? El cliente no los regresó: ${money(retained)} de importe se queda en la tienda (se paga al proveedor) y ya no se podrá regresar.`
    )
    if (!ok) return
    setBusyId(balance.productId)
    setError(null)
    try {
      const res = await fetch("/api/pos/containers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, productId: balance.productId, quantity, action: "writeoff" }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo dar de baja")
      swalToast(`Baja registrada: ${money(data.retained)} se quedan en la tienda`)
      setQty((prev) => ({ ...prev, [balance.productId]: 1 }))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo dar de baja")
    } finally {
      setBusyId(null)
    }
  }

  const refund = async (balance: Balance) => {
    const quantity = Math.min(balance.outstanding, Math.max(1, qty[balance.productId] ?? 1))
    setBusyId(balance.productId)
    setError(null)
    try {
      const res = await fetch("/api/pos/containers", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, productId: balance.productId, quantity }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo registrar la devolución")
      swalToast(data.amount > 0 ? `Regresa ${money(data.amount)} al cliente` : "Envase recibido: se cerró el pendiente")
      setQty((prev) => ({ ...prev, [balance.productId]: 1 }))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la devolución")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <TooltipButton label="Recibir envases" side="bottom" variant="ghost" size="icon" aria-label="Recibir envases" onClick={() => setOpen(true)} data-guide="pos-container-return">
        <Recycle className="size-4" />
      </TooltipButton>
      <DialogComponent
        open={open}
        onOpenChange={setOpen}
        icon={<Recycle className="size-5 text-primary" />}
        title="Recibir envases"
        description="El importe se regresa en efectivo. Si el cliente ya no lo regresará, usa «No regresó»: el importe se queda en la tienda."
        className="sm:max-w-lg"
        footer={
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        }
      >
        <div className="space-y-2">
          {loading && balances.length === 0 && (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Cargando…
            </p>
          )}
          {!loading && balances.length === 0 && !error && (
            <p className="py-6 text-center text-sm text-muted-foreground">No hay envases pendientes de devolver en esta sucursal.</p>
          )}
          {balances.map((balance) => {
            const value = Math.min(balance.outstanding, Math.max(1, qty[balance.productId] ?? 1))
            return (
              <div key={balance.productId} className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{balance.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    {balance.outstanding} pendiente(s) · {money(balance.unitAmount)} c/u{balance.unpaid > 0 ? ` · ${balance.unpaid} sin importe pagado` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label="Menos"
                    disabled={value <= 1}
                    onClick={() => setQty((prev) => ({ ...prev, [balance.productId]: Math.max(1, value - 1) }))}
                    className="press flex size-11 items-center justify-center rounded-xl border bg-card disabled:opacity-40"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="w-8 text-center font-bold tabular-nums">{value}</span>
                  <button
                    type="button"
                    aria-label="Más"
                    disabled={value >= balance.outstanding}
                    onClick={() => setQty((prev) => ({ ...prev, [balance.productId]: Math.min(balance.outstanding, value + 1) }))}
                    className="press flex size-11 items-center justify-center rounded-xl border bg-card disabled:opacity-40"
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
                <Button size="sm" className="shrink-0" onClick={() => void refund(balance)} disabled={busyId === balance.productId}>
                  {busyId === balance.productId ? <Loader2 className="size-4 animate-spin" /> : null} Regresar {money(Math.min(value, balance.paid) * balance.unitAmount)}
                </Button>
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => void writeOff(balance)} disabled={busyId === balance.productId} title="El cliente no los regresó: el importe se queda en la tienda">
                  No regresó
                </Button>
              </div>
            )
          })}
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </div>
      </DialogComponent>
    </>
  )
}
