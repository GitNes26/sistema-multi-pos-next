"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRight, Clock, MapPin, Plus, RefreshCw, Search, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SegmentedFilter } from "@/components/base/segmented-filter"
import { InputGroupField } from "@/components/base/input-group-field"
import { transfersApi, type TransferListRow } from "@/lib/inventory/transfers-client"
import { cn } from "@/lib/utils"
import { TransferStatusPill, TransferStepper } from "./transfer-status"
import { TransferFlowMini } from "./transfer-flow"
import { NewTransferWizard } from "./new-transfer-wizard"
import { useRouter } from "next/navigation"

type Filter = "active" | "pending" | "in_transit" | "received" | "all"

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return "ahora"
  if (m < 60) return `hace ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `hace ${h} h`
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" })
}

/** Tablero de traslados: activos primero, con la etapa de cada uno a la vista. */
export function TransfersBoard({ canManage, locationId }: { canManage: boolean; locationId?: string }) {
  const router = useRouter()
  const [rows, setRows] = useState<TransferListRow[] | null>(null)
  const [filter, setFilter] = useState<Filter>("active")
  const [q, setQ] = useState("")
  const [creating, setCreating] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      setRows(await transfersApi.list({ locationId }))
    } catch {
      setRows([])
    } finally {
      setRefreshing(false)
    }
  }, [locationId])

  useEffect(() => {
    void load()
    // Los traslados en camino cambian solos: refresco suave cada 20 s.
    const id = window.setInterval(() => void load(), 20_000)
    return () => window.clearInterval(id)
  }, [load])

  const counts = useMemo(() => {
    const c = { active: 0, pending: 0, in_transit: 0, received: 0, all: rows?.length ?? 0 }
    for (const r of rows ?? []) {
      if (r.status === "pending" || r.status === "preparing") { c.pending++; c.active++ }
      if (r.status === "in_transit") { c.in_transit++; c.active++ }
      if (r.status === "received") c.received++
    }
    return c
  }, [rows])

  const visible = (rows ?? [])
    .filter((r) =>
      filter === "all" ? true
        : filter === "active" ? ["pending", "preparing", "in_transit"].includes(r.status)
          : filter === "pending" ? r.status === "pending" || r.status === "preparing"
            : r.status === filter
    )
    .filter((r) => !q || `${r.folio} ${r.fromName} ${r.toName} ${r.driverName ?? ""}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedFilter
          ariaLabel="Etapa"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "active", label: "Activos", count: counts.active },
            { value: "pending", label: "Por despachar", count: counts.pending, countTone: counts.pending ? "warning" : undefined },
            { value: "in_transit", label: "En camino", count: counts.in_transit, countTone: counts.in_transit ? "info" : undefined },
            { value: "received", label: "Recibidos", count: counts.received },
            { value: "all", label: "Todos", count: counts.all },
          ]}
        />
        <InputGroupField placeholder="Folio, origen, destino…" leftIcon={<Search className="size-4" />} value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-64" />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => void load()} aria-label="Refrescar">
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
          </Button>
          {canManage && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Nuevo traslado
            </Button>
          )}
        </div>
      </div>

      {rows === null ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Truck className="size-7" />
          </span>
          <div>
            <p className="font-semibold">{filter === "active" ? "No hay traslados en curso" : "Sin traslados en esta vista"}</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Un traslado pasa por cuatro etapas: se solicita, se prepara, sale con el chofer (con GPS) y se recibe contando lo que llegó.
            </p>
          </div>
          {canManage && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Crear el primero
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((r) => (
            <Link
              key={r.id}
              href={`/admin/inventory/transfers/${r.id}`}
              className="press group block space-y-3 rounded-2xl border bg-card p-4 shadow-e1 transition-shadow hover:shadow-e2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">{r.folio}</p>
                  <p className="mt-0.5 flex min-w-0 items-center gap-1.5 font-semibold">
                    <span className="truncate">{r.fromName}</span>
                    <ArrowRight className="size-4 shrink-0 text-primary" />
                    <span className="truncate">{r.toName}</span>
                  </p>
                </div>
                <TransferStatusPill status={r.status} />
              </div>
              <TransferFlowMini status={r.status} />
              <TransferStepper status={r.status} compact />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="tabular-nums">{r.itemCount} productos · {r.totalQty} u.</span>
                {r.status === "in_transit" && (
                  <span className="flex items-center gap-1 text-primary">
                    <MapPin className="size-3.5" />
                    {r.lastLocationAt ? `GPS ${ago(r.lastLocationAt)}` : "Esperando GPS del chofer"}
                  </span>
                )}
                {r.status === "received" && r.hasDiscrepancy && (
                  <span className="flex items-center gap-1 text-warning-ink">
                    <AlertTriangle className="size-3.5" /> Llegó {r.receivedQty} de {r.totalQty}
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1">
                  <Clock className="size-3.5" /> {ago(r.receivedAt ?? r.dispatchedAt ?? r.createdAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <NewTransferWizard open={creating} onOpenChange={setCreating} onCreated={(id) => router.push(`/admin/inventory/transfers/${id}`)} />
    </div>
  )
}
