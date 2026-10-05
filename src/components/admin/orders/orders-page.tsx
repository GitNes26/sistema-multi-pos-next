"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, Search } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { InputGroupField } from "@/components/base/input-group-field"
import { DatePicker } from "@/components/base/date-picker"
import { FormCombobox } from "@/components/base/form-combobox"
import { SwitchField } from "@/components/base/switch-field"
import { DataTable } from "@/components/base/data-table"
import { swalError } from "@/lib/swal"
import { money } from "@/lib/pos/money"
import {
  DELIVERY_METHOD_LABELS,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ordersApi,
} from "@/lib/orders/client"
import type { OrderRow } from "@/lib/orders/server"
import { OrderDetailDialog } from "./order-detail-dialog"
import { OrdersMonitor } from "./orders-monitor"
import { useOrdersLive } from "@/hooks/use-orders-live"
import { ClearFiltersButton } from "@/components/base/clear-filters-button"
import { OrderStatusPill } from "@/components/shared/order-status-pill"
import { SegmentedFilter } from "@/components/base/segmented-filter"

// FASE 12.1 — Vista admin de pedidos: filtros, estados y acciones.

const localIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

const STATUS_TABS = [
  { value: "all", label: "Todos" },
  ...ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] })),
]

export function OrdersPage({
  canManage,
  icon,
}: {
  canManage: boolean
  icon?: React.ReactNode
}) {
  const router = useRouter()
  // Una sola página con dos vistas: tablero en vivo (operación) y lista
  // (búsqueda e historial). La elección se recuerda en este navegador.
  const [view, setView] = useState<"board" | "list">("board")
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("vista")
    if (fromUrl === "tablero" || fromUrl === "lista") return setView(fromUrl === "tablero" ? "board" : "list")
    if (new URLSearchParams(window.location.search).get("q")) return setView("list")
    try {
      const saved = localStorage.getItem("multi-pos.orders-view")
      if (saved === "board" || saved === "list") setView(saved)
    } catch {
      /* sin almacenamiento */
    }
  }, [])
  const changeView = (v: "board" | "list") => {
    setView(v)
    try {
      localStorage.setItem("multi-pos.orders-view", v)
    } catch {
      /* sin almacenamiento */
    }
  }

  const [status, setStatus] = useState("all")
  const [method, setMethod] = useState("all")
  const [activeOnly, setActiveOnly] = useState(false)
  const [search, setSearch] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [locationId, setLocationId] = useState("all")

  const [rows, setRows] = useState<OrderRow[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [detailId, setDetailId] = useState<string | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const r = await ordersApi.list({
        pageSize: 100,
        status: status === "all" ? undefined : status,
        deliveryMethod: method === "all" ? undefined : method,
        locationId: locationId === "all" ? undefined : locationId,
        search: search || undefined,
        from: from || undefined,
        to: to || undefined,
        active: activeOnly || undefined,
      })
      setRows(r.rows)
      setTotal(r.total)
      setCounts(r.counts)
    } catch (err) {
      swalError(
        "No se pudo cargar los pedidos",
        err instanceof Error ? err.message : undefined
      )
    } finally {
      setLoading(false)
    }
  }, [status, method, locationId, search, from, to, activeOnly])

  // Deep link desde notificaciones: ?q=<nº pedido> precarga la búsqueda.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const initial = params.get("q")
    if (initial) setSearch(initial)
  }, [])

  useEffect(() => {
    load()
  }, [load])
  // Pedidos nuevos o con cambios llegan solos a la tabla.
  useOrdersLive(() => void load(true))

  const loadLocations = useCallback(async () => {
    try {
      const r = await fetch("/api/crud/locations?pageSize=200")
      const data = (await r.json()) as { rows: { id: string; name: string }[] }
      setLocations(data.rows ?? [])
    } catch {
      // silencioso
    }
  }, [])
  useEffect(() => {
    loadLocations()
  }, [loadLocations])

  const columns = useMemo(
    () => [
      {
        id: "pedido",
        header: "Pedido",
        cell: ({ row }: { row: { original: OrderRow } }) => (
          <span className="font-semibold tabular-nums">
            #{row.original.orderNumber}
          </span>
        ),
      },
      {
        id: "fecha",
        header: "Fecha",
        cell: ({ row }: { row: { original: OrderRow } }) =>
          new Date(row.original.createdAt).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
      },
      {
        id: "cliente",
        header: "Cliente",
        cell: ({ row }: { row: { original: OrderRow } }) =>
          row.original.customerName ?? "—",
      },
      {
        id: "sucursal",
        header: "Sucursal",
        cell: ({ row }: { row: { original: OrderRow } }) =>
          row.original.locationName ?? "—",
      },
      {
        id: "entrega",
        header: "Entrega",
        cell: ({ row }: { row: { original: OrderRow } }) => (
          <span className="text-muted-foreground">
            {DELIVERY_METHOD_LABELS[row.original.deliveryMethod]}
          </span>
        ),
      },
      {
        id: "estado",
        header: "Estado",
        cell: ({ row }: { row: { original: OrderRow } }) => (
          <OrderStatusPill status={row.original.status} />
        ),
      },
      {
        id: "total",
        header: "Total",
        cell: ({ row }: { row: { original: OrderRow } }) => (
          <span className="font-bold tabular-nums">
            {money(row.original.total)}
          </span>
        ),
      },
      {
        id: "acciones",
        header: "",
        cell: ({ row }: { row: { original: OrderRow } }) => (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setDetailId(row.original.id)}
            >
              <Eye className="size-3.5" /> Ver
            </Button>
          </div>
        ),
      },
    ],
    []
  )

  return (
    <>
      <PageHeader
        icon={icon}
        title="Pedidos"
        description="Pedidos en línea: tablero en vivo para operar y lista para buscar e historial."
        actions={
          <SegmentedFilter
            ariaLabel="Vista"
            value={view}
            onChange={changeView}
            options={[
              { value: "board", label: "Tablero en vivo" },
              { value: "list", label: "Lista" },
            ]}
          />
        }
      />

      {view === "board" ? (
        <OrdersMonitor canManage={canManage} embedded />
      ) : (
      <>

      {/* <ResizableSplit
        prefix="orders"
        locationId={locationId === "all" ? "all" : locationId}
        wide={isWide}
        defaultSizes={isWide ? [28, 72] : [42, 58]}
        minSizes={isWide ? [20, 45] : [30, 35]}
        maxSizes={isWide ? [50, 80] : [65, 70]}
        first={ */}
          <Card>
            <CardContent className="space-y-3 pt-5">
              <div className="flex flex-wrap items-center gap-2">
                <InputGroupField
                  placeholder="Buscar # o cliente"
                  leftIcon={<Search className="size-4" />}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  // className="h-8 w-56"
                />
                <DatePicker
                  value={from ? new Date(from + "T00:00:00") : null}
                  onChange={(d) => setFrom(d ? localIso(d) : "")}
                  placeholder="Desde"
                  clearable
                  className="w-40"
                />
                <DatePicker
                  value={to ? new Date(to + "T00:00:00") : null}
                  onChange={(d) => setTo(d ? localIso(d) : "")}
                  placeholder="Hasta"
                  clearable
                  className="w-40"
                />
                <FormCombobox
                  value={method}
                  onChange={(v) => setMethod(v)}
                  options={[
                    { value: "all", label: "Todas las entregas" },
                    { value: "pickup", label: "Recoger" },
                    { value: "delivery", label: "A domicilio" },
                  ]}
                  clearable={false}
                  searchable={false}
                  className="w-52"
                />
                <FormCombobox
                  value={locationId}
                  onChange={(v) => setLocationId(v)}
                  options={[
                    { value: "all", label: "Todas las sucursales" },
                    ...locations.map((l) => ({ value: l.id, label: l.name })),
                  ]}
                  clearable={false}
                  searchable={locations.length > 5}
                  className="w-52"
                />
                <SwitchField
                  label="Activos"
                  checked={activeOnly}
                  onCheckedChange={setActiveOnly}
                  border={false}
                  className="w-auto"
                />
                <ClearFiltersButton
                  active={Boolean(search || from || to || status !== "all" || method !== "all" || locationId !== "all" || activeOnly)}
                  onClear={() => {
                    setSearch("")
                    setFrom("")
                    setTo("")
                    setStatus("all")
                    setMethod("all")
                    setLocationId("all")
                    setActiveOnly(false)
                  }}
                />
              </div>

              <DataTable
                columns={columns}
                data={rows}
                searchable={false}
                showColumnVisibility={false}
                showPagination={false}
                loading={loading}
                emptyMessage="Sin pedidos para los filtros"
                rowKey={(r) => r.id}
                onRefresh={() => load()}
                refreshing={loading}
                toolbarSlot={
                  <SegmentedFilter
                    ariaLabel="Estado del pedido"
                    value={status}
                    onChange={setStatus}
                    options={STATUS_TABS.map((t) => ({
                      value: t.value,
                      label: t.label,
                      count: t.value === "all" ? total : (counts[t.value] ?? 0),
                      countTone: t.value === "pending" && (counts.pending ?? 0) > 0 ? "warning" : undefined,
                    }))}
                  />
                }
              />
            </CardContent>
          </Card>
         {/* }
       /> */}
      </>
      )}

      {detailId && (
        <OrderDetailDialog
          orderId={detailId}
          canManage={canManage}
          onChanged={() => {
            setDetailId(null)
            load()
          }}
          onUpdated={() => void load(true)}
        />
      )}
    </>
  )
}
