"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface CohortRow {
  cohort: string
  initialCount: number
  retention: (number | null)[]
}

interface Props { from?: string; to?: string }

export function CohortReport({ from, to }: Props) {
  const [data, setData] = useState<{ cohorts: CohortRow[]; months: string[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ report: "cohorts" })
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    fetch(`/api/reports/bi?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [from, to])

  const getHeatColor = (pct: number | null) => {
    if (pct === null) return "bg-muted text-muted-foreground"
    if (pct >= 50) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
    if (pct >= 30) return "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
    if (pct >= 15) return "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
    return "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
  }

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  if (!data || data.cohorts.length === 0) return <p className="py-10 text-center text-muted-foreground">Sin datos de cohortes</p>

  const maxCols = Math.max(...data.cohorts.map((c) => c.retention.length))

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Retención de clientes mes a mes. Cada fila es un grupo de clientes que hizo su primera compra en ese mes.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Cohort</th>
              <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Clientes</th>
              {Array.from({ length: maxCols }, (_, i) => (
                <th key={i} className="px-2 py-1.5 text-center font-medium text-muted-foreground">Mes {i}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.cohorts.filter((c) => c.initialCount > 0).map((row) => (
              <tr key={row.cohort}>
                <td className="whitespace-nowrap px-2 py-1.5 font-medium">{row.cohort}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{row.initialCount}</td>
                {row.retention.map((pct, i) => (
                  <td key={i} className="px-1 py-1.5">
                    <div className={cn("flex h-7 items-center justify-center rounded text-[10px] font-bold tabular-nums", getHeatColor(pct))}>
                      {pct !== null ? `${pct}%` : "—"}
                    </div>
                  </td>
                ))}
                {/* Fill remaining cells */}
                {Array.from({ length: maxCols - row.retention.length }, (_, i) => (
                  <td key={`fill-${i}`} className="px-1 py-1.5">
                    <div className="h-7 rounded bg-muted" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
