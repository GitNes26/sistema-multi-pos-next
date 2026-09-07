"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, Flame, Loader2, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { swalConfirm, swalError, swalToast } from "@/lib/swal"
import { cn } from "@/lib/utils"

// Sección "Cocina" del ticket del POS: muestra la orden abierta de la mesa
// seleccionada (número, estado en vivo del KDS, artículos y tiempo transcurrido)
// con la acción de cancelación (pull-back) inline. Consulta /api/pos/kitchen
// cada 15 s y se refresca al enviar más artículos a cocina (prop refreshKey).

interface KitchenOrderItem {
  id: string
  productName: string
  variantName: string | null
  quantity: number
  itemStatus: string
}

interface KitchenOrder {
  id: string
  orderNumber: number
  status: "pending" | "confirmed" | "preparing" | string
  createdAt: string
  items: KitchenOrderItem[]
}

const STATUS_META: Record<string, { label: string; badge: string }> = {
  pending: { label: "Pendiente", badge: "bg-slate-500/15 text-slate-600 dark:text-slate-300" },
  confirmed: { label: "Enviada", badge: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  preparing: { label: "En preparación", badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
}

const ITEM_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  preparing: "En fuego",
  ready: "Listo",
  served: "Servido",
}

/** mm:ss transcurridos desde `from` (ISO), actualizado cada 15 s con el poll. */
function elapsed(from: string, now: number): string {
  const secs = Math.max(0, Math.floor((now - new Date(from).getTime()) / 1000))
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`
}

export function KitchenStatus({
  tableId,
  /** Cambia al enviar a cocina (lastSent) para refrescar de inmediato. */
  refreshKey,
  onKitchenOrderCancelled,
}: {
  tableId: string | null
  refreshKey?: number
  /** Llamado al cancelar la orden: el ticket vuelve a "sin enviar". */
  onKitchenOrderCancelled?: () => void
}) {
  const [order, setOrder] = useState<KitchenOrder | null>(null)
  const [loading, setLoading] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [tick, setTick] = useState(() => Date.now())

  const load = useCallback(async () => {
    if (!tableId || tableId.startsWith("manual-")) {
      setOrder(null)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/pos/kitchen?tableId=${tableId}`, { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (data.ok) {
        setOrder(data.order ?? null)
        setTick(Date.now())
      }
    } catch {
      /* noop: la sección se queda con lo último que tenga */
    } finally {
      setLoading(false)
    }
  }, [tableId])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  // Polling en vivo (15 s): el estado de cocina avanza sin recargar el ticket.
  useEffect(() => {
    const timer = setInterval(() => {
      void load()
    }, 15000)
    return () => clearInterval(timer)
  }, [load])

  if (!tableId || tableId.startsWith("manual-")) return null

  const cancelOrder = async () => {
    if (!order || cancelling) return
    const ok = await swalConfirm(
      "¿Cancelar la orden de cocina?",
      `El pedido #${order.orderNumber} saldrá del KDS y no se cobrará. La mesa queda libre.`,
      { confirmText: "Cancelar orden", danger: true, icon: "warning" }
    )
    if (!ok) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/pos/kitchen?orderId=${order.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo cancelar la orden")
      swalToast(`Orden #${data.orderNumber} cancelada`)
      setOrder(null)
      // El ticket vuelve a "sin enviar" para reenviar, editar o cobrar.
      onKitchenOrderCancelled?.()
    } catch (err) {
      swalError("No se pudo cancelar", err instanceof Error ? err.message : "Intenta de nuevo")
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-3 py-2.5">
      <div className="flex items-center gap-2">
        {loading && !order ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-amber-600" />
        ) : (
          <Flame className={cn("size-4 shrink-0 text-amber-600", order?.status === "preparing" && "animate-pulse")} />
        )}
        <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
          Cocina
        </span>
        {order ? (
          <>
            <span className="ml-auto text-xs font-semibold text-amber-700 dark:text-amber-400 tabular-nums">
              #{order.orderNumber} · {elapsed(order.createdAt, tick)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={cancelling}
              onClick={cancelOrder}
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
            >
              {cancelling ? <Loader2 className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
              Cancelar
            </Button>
          </>
        ) : (
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5" />
            Sin orden en cocina
          </span>
        )}
      </div>

      {order && (
        <div className="mt-2 space-y-1.5 border-t border-amber-500/20 pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[0.65rem] font-semibold",
                STATUS_META[order.status]?.badge ?? "bg-muted text-muted-foreground"
              )}
            >
              {STATUS_META[order.status]?.label ?? order.status}
            </span>
            <span className="text-[0.65rem] text-muted-foreground">
              {order.items.length} {order.items.length === 1 ? "artículo" : "artículos"}
            </span>
          </div>
          <ul className="space-y-0.5">
            {order.items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-foreground">
                  {i.quantity} × {i.productName}
                  {i.variantName && i.productName !== i.variantName ? ` (${i.variantName})` : ""}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[0.65rem] font-medium",
                    i.itemStatus === "ready" || i.itemStatus === "served"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground"
                  )}
                >
                  {ITEM_STATUS_LABELS[i.itemStatus] ?? i.itemStatus}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
