"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { money } from "@/lib/pos/money"

interface Cell { dayOfWeek: number; hour: number; sales: number; count: number }

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6) // 6am-23pm

interface Props { from?: string; to?: string; locationId?: string }

export function HeatmapReport({ from, to, locationId }: Props) {
  const [grid, setGrid] = useState<Cell[][] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ report: "heatmap" })
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    if (locationId) params.set("locationId", locationId)
    fetch(`/api/reports/bi?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setGrid(d.grid) })
      .catch((err) => console.error("[bi-heatmap] Error cargando reporte:", err))
      .finally(() => setLoading(false))
  }, [from, to, locationId])

  const maxSales = useMemo(() => {
    if (!grid) return 1
    return Math.max(...grid.flat().map((c) => c.sales), 1)
  }, [grid])

  const getIntensity = (sales: number) => {
    const ratio = sales / maxSales
    if (ratio === 0) return "bg-muted"
    if (ratio < 0.25) return "bg-emerald-100 dark:bg-emerald-900/30"
    if (ratio < 0.5) return "bg-emerald-200 dark:bg-emerald-800/40"
    if (ratio < 0.75) return "bg-emerald-400 dark:bg-emerald-600/50"
    return "bg-emerald-600 dark:bg-emerald-500/60"
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  if (!grid) return <p className="py-10 text-center text-muted-foreground">Sin datos</p>

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="w-10" />
              {HOURS.map((h) => (
                <th key={h} className="px-1 py-1 text-center font-medium text-muted-foreground">{h}:00</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, dow) => (
              <tr key={dow}>
                <td className="pr-2 font-medium">{day}</td>
                {HOURS.map((h) => {
                  const cell = grid[dow]?.[h]
                  const sales = cell?.sales ?? 0
                  const count = cell?.count ?? 0
                  return (
                    <td key={h} className="p-0.5">
                      <div
                        className={cn("flex h-8 w-full items-center justify-center rounded text-[10px] font-medium transition-colors", getIntensity(sales))}
                        title={`${day} ${h}:00 — ${money(sales)} (${count} transacciones)`}
                      >
                        {sales > 0 ? count : ""}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>Menos</span>
        <span className="size-3 rounded bg-muted" />
        <span className="size-3 rounded bg-emerald-100 dark:bg-emerald-900/30" />
        <span className="size-3 rounded bg-emerald-200 dark:bg-emerald-800/40" />
        <span className="size-3 rounded bg-emerald-400 dark:bg-emerald-600/50" />
        <span className="size-3 rounded bg-emerald-600 dark:bg-emerald-500/60" />
        <span>Más</span>
      </div>
    </div>
  )
}
