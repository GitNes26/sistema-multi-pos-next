"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckCircle2, ChevronDown, Flame, Loader2, Undo2 } from "lucide-react"
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
  pending: { label: "Pendiente", badge: "bg-muted-foreground/15 text-muted-foreground" },
  confirmed: { label: "Enviada", badge: "bg-info/15 text-info-ink" },
  preparing: { label: "En preparación", badge: "bg-warning/15 text-warning-ink" },
  ready: { label: "Lista · pendiente de cobro", badge: "bg-success/15 text-success-ink" },
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
  /** Comanda para llevar (sin mesa). */
  orderId,
  /** Cambia al enviar a cocina (lastSent) para refrescar de inmediato. */
  refreshKey,
  onKitchenOrderCancelled,
}: {
  tableId: string | null
  orderId?: string | null
  refreshKey?: number
  /** Llamado al cancelar la orden: el ticket vuelve a "sin enviar". */
  onKitchenOrderCancelled?: () => void
}) {
  const [order, setOrder] = useState<KitchenOrder | null>(null)
  const [loading, setLoading] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [tick, setTick] = useState(() => Date.now())
  // Acordeón: se recuerda abierto/cerrado en este equipo.
  const [open, setOpen] = useState(false)
  useEffect(() => {
    try {
      setOpen(localStorage.getItem("multi-pos.kitchen-status-open") === "1")
    } catch {
      /* sin almacenamiento */
    }
  }, [])
  const toggle = () =>
    setOpen((v) => {
      try {
        localStorage.setItem("multi-pos.kitchen-status-open", v ? "0" : "1")
      } catch {
        /* sin almacenamiento */
      }
      return !v
    })

  const load = useCallback(async () => {
    const realTable = tableId && !tableId.startsWith("manual-") ? tableId : null
    if (!realTable && !orderId) {
      setOrder(null)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/pos/kitchen?${realTable ? `tableId=${realTable}` : `orderId=${orderId}`}`, { cache: "no-store" })
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
  }, [tableId, orderId])

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

  if ((!tableId || tableId.startsWith("manual-")) && !orderId) return null

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

  // Resumen para la fila contraída: artículos listos / servidos de los que lleva la orden.
  const total = order?.items.length ?? 0
  const ready = order?.items.filter((i) => i.itemStatus === "ready" || i.itemStatus === "served").length ?? 0
  const allReady = total > 0 && ready === total

  return (
    <div className={cn("rounded-xl border px-3 py-2", allReady ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5")}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? "Contraer la cocina" : "Ver la orden de cocina"}
        className="flex min-h-10 w-full items-center gap-2 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {loading && !order ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-warning-ink" />
        ) : (
          <Flame className={cn("size-4 shrink-0", allReady ? "text-success-ink" : "text-warning-ink", order?.status === "preparing" && "animate-pulse")} />
        )}
        <span className={cn("text-xs font-bold uppercase tracking-wide", allReady ? "text-success-ink" : "text-warning-ink")}>Cocina</span>
        {order ? (
          <>
            <span
              className={cn(
                "truncate rounded-full px-2 py-0.5 text-[0.65rem] font-semibold",
                STATUS_META[order.status]?.badge ?? "bg-muted text-muted-foreground"
              )}
            >
              {STATUS_META[order.status]?.label ?? order.status}
            </span>
            <span className="ml-auto shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
              {ready}/{total} · #{order.orderNumber} · {elapsed(order.createdAt, tick)}
            </span>
          </>
        ) : (
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5" />
            Sin orden en cocina
          </span>
        )}
        {order && <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />}
      </button>

      {order && open && (
        <div className="mt-1.5 space-y-1.5 border-t border-warning/20 pt-2">
          <ul className="space-y-0.5">
            {order.items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-foreground">
                  {i.quantity} × {i.productName}
                  {i.variantName && i.variantName !== "Default" && i.productName !== i.variantName ? ` (${i.variantName})` : ""}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[0.65rem] font-medium",
                    i.itemStatus === "ready" || i.itemStatus === "served" ? "text-success-ink" : "text-muted-foreground"
                  )}
                >
                  {ITEM_STATUS_LABELS[i.itemStatus] ?? i.itemStatus}
                </span>
              </li>
            ))}
          </ul>
          <Button
            variant="ghost"
            size="sm"
            disabled={cancelling}
            onClick={cancelOrder}
            className="h-8 w-full justify-center text-xs text-destructive hover:text-destructive"
          >
            {cancelling ? <Loader2 className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
            Cancelar la orden de cocina
          </Button>
        </div>
      )}
    </div>
  )
}
