"use client"

import { useEffect, useState } from "react"
import { Loader2, ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { money } from "@/lib/pos/money"
import { cn } from "@/lib/utils"

interface Row {
  productName: string
  categoryName: string
  quantity: number
  revenue: number
  margin: number
  marginPct: number
}

type SortKey = "quantity" | "revenue" | "margin"

interface Props { from?: string; to?: string; locationId?: string }

export function ProductRankingReport({ from, to, locationId }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [sort, setSort] = useState<SortKey>("revenue")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ report: "ranking", sort })
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    if (locationId) params.set("locationId", locationId)
    fetch(`/api/reports/bi?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setRows(d.rows) })
      .catch((err) => console.error("[bi-ranking] Error cargando reporte:", err))
      .finally(() => setLoading(false))
  }, [from, to, locationId, sort])

  const maxVal = Math.max(...rows.map((r) => (sort === "quantity" ? r.quantity : sort === "margin" ? r.margin : r.revenue)), 1)
  const getValue = (r: Row) => sort === "quantity" ? r.quantity : sort === "margin" ? r.margin : r.revenue

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {(["revenue", "quantity", "margin"] as SortKey[]).map((s) => (
          <Button key={s} variant={sort === s ? "default" : "outline"} size="sm" onClick={() => setSort(s)}>
            {s === "revenue" ? "Ingreso" : s === "quantity" ? "Unidades" : "Margen"}
          </Button>
        ))}
      </div>

      <div className="space-y-1.5">
        {rows.slice(0, 20).map((r, i) => (
          <div key={r.productName} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm">
            <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
              i < 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{r.productName}</p>
              <p className="text-xs text-muted-foreground">{r.categoryName}</p>
            </div>
            <div className="w-32">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${(getValue(r) / maxVal) * 100}%` }} />
              </div>
            </div>
            <div className="w-24 text-right tabular-nums">
              {sort === "quantity" && <span>{r.quantity} u</span>}
              {sort === "revenue" && <span className="font-bold">{money(r.revenue)}</span>}
              {sort === "margin" && <><span className="font-bold">{money(r.margin)}</span> <span className="text-xs text-muted-foreground">{r.marginPct}%</span></>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
