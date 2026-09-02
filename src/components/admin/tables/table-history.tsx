"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Armchair,
  Clock,
  DollarSign,
  Hash,
  History,
  ShoppingBag,
  TrendingUp,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { DialogComponent } from "@/components/ui/dialog"
import { Spinner } from "@/components/base/spinner"
import { EmptyState } from "@/components/shared/empty-state"
import { money } from "@/lib/pos/money"
import { cn } from "@/lib/utils"

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

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  preparing: "Preparando",
  ready: "Listo",
  delivered: "Entregado",
  cancelled: "Cancelado",
}

const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  confirmed: "bg-blue-100 text-blue-600",
  preparing: "bg-amber-100 text-amber-600",
  ready: "bg-emerald-100 text-emerald-600",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-rose-100 text-rose-600",
}

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

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={tableNumber != null ? `Historial Mesa #${tableNumber}` : "Historial"}
      icon={<History className="size-5" />}
      size="lg"
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : error ? (
        <div className="py-8 text-center text-sm text-destructive">{error}</div>
      ) : !data ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Sin datos
        </div>
      ) : data.sessions.length === 0 && data.orders.length === 0 ? (
        <EmptyState
          icon={Armchair}
          title="Sin historial"
          description="Esta mesa aún no tiene sesiones ni órdenes registradas."
        />
      ) : (
        <div className="space-y-5">
          {/* ── Summary stats ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={DollarSign}
              iconBg="bg-emerald-100"
              iconColor="text-emerald-600"
              label="Ingresos totales"
              value={money(data.stats.totalRevenue)}
            />
            <StatCard
              icon={ShoppingBag}
              iconBg="bg-blue-100"
              iconColor="text-blue-600"
              label="Órdenes"
              value={String(data.stats.totalOrders)}
            />
            <StatCard
              icon={Clock}
              iconBg="bg-amber-100"
              iconColor="text-amber-600"
              label="Sesiones"
              value={String(data.stats.totalSessions)}
            />
            <StatCard
              icon={TrendingUp}
              iconBg="bg-violet-100"
              iconColor="text-violet-600"
              label="Ticket promedio"
              value={money(data.stats.avgOrderValue)}
            />
          </div>

          {/* ── Sessions timeline ── */}
          {data.sessions.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Clock className="size-4" />
                Sesiones ({data.sessions.length})
              </h4>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {data.sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-start gap-3 rounded-xl border p-3 text-sm"
                  >
                    {/* Timeline dot */}
                    <div className="mt-1 flex flex-col items-center">
                      <div
                        className={cn(
                          "w-2.5 h-2.5 rounded-full",
                          s.endedAt ? "bg-slate-300" : "bg-emerald-500 animate-pulse"
                        )}
                      />
                      {s.endedAt && (
                        <div className="w-px flex-1 bg-slate-200 mt-1" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {new Date(s.startedAt).toLocaleDateString("es-MX", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDuration(s.startedAt, s.endedAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(s.startedAt).toLocaleTimeString("es-MX", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {s.endedAt &&
                          ` → ${new Date(s.endedAt).toLocaleTimeString("es-MX", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`}
                      </p>

                      {s.order && (
                        <div className="flex items-center justify-between gap-2 mt-1.5">
                          <div className="flex items-center gap-1.5">
                            <Hash className="size-3 text-muted-foreground" />
                            <span className="font-mono text-xs">
                              #{s.order.orderNumber}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0",
                                ORDER_STATUS_COLORS[s.order.status] ?? ""
                              )}
                            >
                              {ORDER_STATUS_LABELS[s.order.status] ?? s.order.status}
                            </Badge>
                          </div>
                          <span className="font-semibold tabular-nums">
                            {money(s.order.total)}
                          </span>
                        </div>
                      )}

                      {s.notes && (
                        <p className="text-xs text-muted-foreground italic mt-1">
                          📝 {s.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Orders list ── */}
          {data.orders.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <ShoppingBag className="size-4" />
                Órdenes ({data.orders.length})
              </h4>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {data.orders.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-medium text-xs">
                        #{o.orderNumber}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0",
                          ORDER_STATUS_COLORS[o.status] ?? ""
                        )}
                      >
                        {ORDER_STATUS_LABELS[o.status] ?? o.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {o.itemCount} art.
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {new Date(o.createdAt).toLocaleDateString("es-MX", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {money(o.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </DialogComponent>
  )
}

/* ------------------------------------------------------------------ */
/*  StatCard helper                                                    */
/* ------------------------------------------------------------------ */

function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  iconColor: string
  label: string
  value: string
}) {
  return (
    <Card>
      <CardContent className="pt-3 pb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              iconBg
            )}
          >
            <Icon className={cn("w-4 h-4", iconColor)} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-base font-bold tabular-nums">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
