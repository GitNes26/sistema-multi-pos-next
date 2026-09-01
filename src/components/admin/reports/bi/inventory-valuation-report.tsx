"use client"

import { useEffect, useState } from "react"
import { Loader2, Package, AlertTriangle } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { money } from "@/lib/pos/money"

interface Row {
  categoryName: string
  valueAtCost: number
  valueAtRetail: number
  productCount: number
  outOfStock: number
}

interface Props { from?: string; to?: string; locationId?: string }

export function InventoryValuationReport({ from, to, locationId }: Props) {
  const [data, setData] = useState<{ rows: Row[]; totals: { valueAtCost: number; valueAtRetail: number; outOfStock: number } } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ report: "inventory" })
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    if (locationId) params.set("locationId", locationId)
    fetch(`/api/reports/bi?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [from, to, locationId])

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  if (!data) return <p className="py-10 text-center text-muted-foreground">Sin datos</p>

  const maxCost = Math.max(...data.rows.map((r) => r.valueAtCost), 1)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Valor a costo</div>
          <p className="mt-1 text-xl font-black tabular-nums">{money(data.totals.valueAtCost)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Valor a precio venta</div>
          <p className="mt-1 text-xl font-black tabular-nums">{money(data.totals.valueAtRetail)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-1 text-xs text-muted-foreground"><AlertTriangle className="size-3" /> Sin stock</div>
          <p className="mt-1 text-xl font-black text-destructive">{data.totals.outOfStock}</p>
        </CardContent></Card>
      </div>

      <div className="space-y-2">
        {data.rows.map((r) => (
          <div key={r.categoryName} className="rounded-xl border p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{r.categoryName}</p>
                <p className="text-xs text-muted-foreground">{r.productCount} productos · {r.outOfStock} sin stock</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums">{money(r.valueAtCost)}</p>
                <p className="text-xs text-muted-foreground tabular-nums">{money(r.valueAtRetail)} venta</p>
              </div>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(r.valueAtCost / maxCost) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
