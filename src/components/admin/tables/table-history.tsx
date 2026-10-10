"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Armchair,
  Clock,
  DollarSign,
  Receipt,
  History,
  ShoppingBag,
  TrendingUp,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { DialogComponent } from "@/components/ui/dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { money } from "@/lib/pos/money"
import { cn } from "@/lib/utils"
import { OrderStatusPill } from "@/components/shared/order-status-pill"

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TableInfo {
  id: string
  number: number
  name: string | null
  capacity: number
  status: string
}

interface SessionEntry {
  id: string
  startedAt: string
  endedAt: string | null
  notes: string | null
  orderId: string | null
  order: {
    id: string
    orderNumber: number
    status: string
    total: number
    deliveryMethod: string
    createdAt: string
    itemCount: number
  } | null
}

interface OrderEntry {
  id: string
  orderNumber: number
  status: string
  total: number
  deliveryMethod: string
  createdAt: string
  itemCount: number
}

interface TableStats {
  totalRevenue: number
  totalSessions: number
  totalOrders: number
  avgOrderValue: number
}

interface HistoryData {
  table: TableInfo
  sessions: SessionEntry[]
  orders: OrderEntry[]
  stats: TableStats
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDuration(start: string, end: string | null): string {
  const ms = (end ? new Date(end) : new Date()).getTime() - new Date(start).getTime()
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainingMin = minutes % 60
  return `${hours}h ${remainingMin}m`
}

/* ------------------------------------------------------------------ */
/*  TableHistoryDialog                                                 */
/* ------------------------------------------------------------------ */

interface Props {
  open: boolean
  tableId: string | null
  tableNumber: number | null
  onClose: () => void
}

export function TableHistoryDialog({ open, tableId, tableNumber, onClose }: Props) {
  const [data, setData] = useState<HistoryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!tableId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/tables/history?tableId=${tableId}`).then((r) => r.json())
      if (res.ok) {
        setData(res)
      } else {
        setError(res.error || "Error al cargar historial")
      }
    } catch {
      setError("Error de conexión")
    } finally {
      setLoading(false)
    }
  }, [tableId])

  useEffect(() => {
    if (open && tableId) load()
    if (!open) {
      setData(null)
      setError(null)
    }
  }, [open, tableId, load])

  // Visitas y órdenes en una sola línea de tiempo por día (las órdenes ligadas a una sesión no se repiten).
  type Entry = {
    key: string
    at: string
    endedAt: string | null
    live: boolean
    notes: string | null
    order: { orderNumber: number; status: string; total: number; itemCount: number } | null
  }
  const entries: Entry[] = []
  if (data) {
    const inSession = new Set<string>()
    for (const s of data.sessions) {
      if (s.order) inSession.add(s.order.id)
      entries.push({ key: `s-${s.id}`, at: s.startedAt, endedAt: s.endedAt, live: !s.endedAt, notes: s.notes, order: s.order ? { orderNumber: s.order.orderNumber, status: s.order.status, total: s.order.total, itemCount: s.order.itemCount } : null })
    }
    for (const o of data.orders) {
      if (inSession.has(o.id)) continue
      entries.push({ key: `o-${o.id}`, at: o.createdAt, endedAt: null, live: false, notes: null, order: { orderNumber: o.orderNumber, status: o.status, total: o.total, itemCount: o.itemCount } })
    }
    entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }
  const byDay = new Map<string, Entry[]>()
  for (const e of entries) {
    const day = new Date(e.at).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    byDay.set(day, [...(byDay.get(day) ?? []), e])
  }
  const time = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={tableNumber != null ? `Historial · Mesa ${tableNumber}` : "Historial"}
      description={data ? `${data.table.name ? `${data.table.name} · ` : ""}${data.table.capacity} personas` : undefined}
      icon={<History className="size-5" />}
      size="2xl"
      bodyClassName="space-y-5"
    >
      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : error ? (
        <div className="py-8 text-center text-sm text-destructive">{error}</div>
      ) : !data ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Sin datos</div>
      ) : entries.length === 0 ? (
        <EmptyState icon={Armchair} title="Sin historial" description="Esta mesa aún no tiene sesiones ni órdenes registradas." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard icon={DollarSign} tone="success" label="Ingresos" value={money(data.stats.totalRevenue)} />
            <StatCard icon={ShoppingBag} tone="info" label="Órdenes" value={String(data.stats.totalOrders)} />
            <StatCard icon={Clock} tone="warning" label="Visitas" value={String(data.stats.totalSessions)} />
            <StatCard icon={TrendingUp} tone="primary" label="Ticket promedio" value={money(data.stats.avgOrderValue)} />
          </div>

          <div className="space-y-5">
            {[...byDay.entries()].map(([day, list]) => (
              <section key={day} className="space-y-2">
                <h4 className="sticky top-0 z-10 -mx-1 bg-popover/95 px-1 py-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase backdrop-blur">
                  {day}
                </h4>
                <ol className="relative space-y-2 border-l pl-4">
                  {list.map((e) => (
                    <li key={e.key} className="relative rounded-xl border bg-card p-3 text-sm">
                      <span
                        className={cn(
                          "absolute top-4 -left-[1.38rem] size-2.5 rounded-full ring-4 ring-popover",
                          e.live ? "animate-pulse bg-success" : "bg-muted-foreground/40"
                        )}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <span className="font-semibold tabular-nums">
                          {time(e.at)}
                          {e.endedAt && <span className="font-normal text-muted-foreground"> → {time(e.endedAt)}</span>}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
                          {e.live ? "En curso · " : ""}
                          {formatDuration(e.at, e.endedAt)}
                        </span>
                      </div>
                      {e.order && (
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 px-2.5 py-2">
                          <span className="flex min-w-0 items-center gap-2">
                            <Receipt className="size-4 shrink-0 text-muted-foreground" />
                            <span className="font-mono text-xs font-medium">#{e.order.orderNumber}</span>
                            <OrderStatusPill status={e.order.status} />
                            <span className="text-xs text-muted-foreground">
                              {e.order.itemCount} {e.order.itemCount === 1 ? "artículo" : "artículos"}
                            </span>
                          </span>
                          <span className="font-bold tabular-nums">{money(e.order.total)}</span>
                        </div>
                      )}
                      {e.notes && <p className="mt-2 text-xs text-muted-foreground italic">“{e.notes}”</p>}
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </>
      )}
    </DialogComponent>
  )
}

/* ------------------------------------------------------------------ */
/*  StatCard helper                                                    */
/* ------------------------------------------------------------------ */

const TONES = {
  success: "bg-success/10 text-success-ink",
  info: "bg-info/10 text-info-ink",
  warning: "bg-warning/10 text-warning-ink",
  primary: "bg-primary/10 text-primary",
} as const

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  tone: keyof typeof TONES
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-3">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", TONES[tone])}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs text-muted-foreground">{label}</span>
        <span className="block truncate text-base font-bold tabular-nums">{value}</span>
      </span>
    </div>
  )
}
