"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import {
  PackageCheck,
  RefreshCw,
  Truck,
  CircleCheckBig,
  Clock,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { money } from "@/lib/pos/money"
import { swalError } from "@/lib/swal"
import {
  DELIVERY_METHOD_LABELS,
  ORDER_STATUS_LABELS,
  ordersApi,
} from "@/lib/orders/client"
import type { OrderRow } from "@/lib/orders/server"
import { OrderDetailDialog } from "./order-detail-dialog"

const MONITOR_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "in_transit",
  "delivered",
] as const

const STATUS_CARD_STYLE: Record<string, string> = {
  pending: "border-amber-300 bg-amber-50/60 dark:bg-amber-950/20",
  confirmed: "border-sky-300 bg-sky-50/60 dark:bg-sky-950/20",
  preparing: "border-orange-300 bg-orange-50/60 dark:bg-orange-950/20",
  ready: "border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20",
  in_transit: "border-violet-300 bg-violet-50/60 dark:bg-violet-950/20",
  delivered: "border-blue-300 bg-blue-50/60 dark:bg-blue-950/20",
}

const STATUS_DOT: Record<string, string> = {
  pending: "bg-amber-500",
  confirmed: "bg-sky-500",
  preparing: "bg-orange-500",
  ready: "bg-emerald-500",
  in_transit: "bg-violet-500",
  delivered: "bg-blue-600",
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <Clock className="size-3.5" />,
  confirmed: <CircleCheckBig className="size-3.5" />,
  preparing: <PackageCheck className="size-3.5" />,
  ready: <PackageCheck className="size-3.5" />,
  in_transit: <Truck className="size-3.5" />,
  delivered: <CircleCheckBig className="size-3.5" />,
}

export function OrdersMonitor({
  canManage,
  icon,
}: {
  canManage: boolean
  icon?: React.ReactNode
}) {
  const router = useRouter()
  const [byStatus, setByStatus] = useState<Record<string, OrderRow[]>>({
    pending: [],
    confirmed: [],
    preparing: [],
    ready: [],
    in_transit: [],
    delivered: [],
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(() => new Date())

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setRefreshing(true)
    try {
      const r = await ordersApi.list({ active: true, pageSize: 200 })
      const grouped: Record<string, OrderRow[]> = {
        pending: [],
        confirmed: [],
        preparing: [],
        ready: [],
        in_transit: [],
        delivered: [],
      }
      for (const o of r.rows) {
        // Merge at_destination into in_transit column
        const col = o.status === "at_destination" ? "in_transit" : o.status
        if (grouped[col]) grouped[col].push(o)
      }
      setByStatus(grouped)
      setLastUpdate(new Date())
    } catch (err) {
      swalError(
        "No se pudo cargar el monitoreo",
        err instanceof Error ? err.message : undefined
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    const t = setInterval(() => load(true), 30_000)
    return () => clearInterval(t)
  }, [load])

  const activeTotal = MONITOR_STATUSES.reduce(
    (a, s) => a + (byStatus[s]?.length ?? 0),
    0
  )

  return (
    <>
      <PageHeader
        icon={icon ?? <Truck className="size-5" />}
        title="Monitoreo de pedidos"
        description="Semáforo de estados en tiempo real."
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {activeTotal} activo(s) · {lastUpdate.toLocaleTimeString("es-MX")}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => load(true)}
              disabled={refreshing}
            >
              <RefreshCw
                className={cn("size-4", refreshing && "animate-spin")}
              />{" "}
              Refrescar
            </Button>
          </div>
        }
      />

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-2xl border bg-muted"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 h-fu">
          {MONITOR_STATUSES.map((status) => (
            <section
              key={status}
              className="rounded-2xl border bg-card shadow-sm overflow-hidden"
            >
              <header
                className={cn(
                  "flex items-center gap-2 border-b px-3 py-2.5",
                  STATUS_CARD_STYLE[status]
                )}
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full",
                    STATUS_DOT[status],
                    "text-white"
                  )}
                >
                  {STATUS_ICON[status]}
                </span>
                <span className="text-sm font-semibold">
                  {ORDER_STATUS_LABELS[status]}
                </span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {byStatus[status]?.length ?? 0}
                </Badge>
              </header>
              <div className="space-y-1.5 p-2 overflow-y-auto">
                <AnimatePresence>
                  {(byStatus[status] ?? []).length === 0 && (
                    <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                      Sin pedidos
                    </p>
                  )}
                  {(byStatus[status] ?? []).map((o) => (
                    <motion.div
                      key={o.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                    >
                      <button
                        onClick={() => setDetailId(o.id)}
                        className={cn(
                          "w-full cursor-pointer rounded-xl border px-3 py-2.5 text-left transition-all hover:shadow-md active:scale-[0.98]",
                          o.status === "at_destination"
                            ? "border-purple-300 bg-purple-50/60 dark:bg-purple-950/20"
                            : STATUS_CARD_STYLE[status]
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold tabular-nums">
                            #{o.orderNumber}
                          </span>
                          {o.status === "at_destination" && (
                            <Badge className="h-4 px-1.5 text-[0.6rem] bg-purple-500">
                              En domicilio
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(o.createdAt), {
                              addSuffix: true,
                              locale: es,
                            })}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-xs">
                          {o.customerName ?? "Cliente"}
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            {DELIVERY_METHOD_LABELS[o.deliveryMethod]}
                          </span>
                          <span className="font-bold tabular-nums">
                            {money(o.total)}
                          </span>
                        </div>
                        {canManage && status === "preparing" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 w-full"
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/admin/orders/${o.id}/prepare`)
                            }}
                          >
                            <PackageCheck className="size-3.5" /> Preparar
                          </Button>
                        )}
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          ))}
        </div>
      )}

      {detailId && (
        <OrderDetailDialog
          orderId={detailId}
          canManage={canManage}
          onChanged={() => {
            setDetailId(null)
            load()
          }}
        />
      )}
    </>
  )
}
