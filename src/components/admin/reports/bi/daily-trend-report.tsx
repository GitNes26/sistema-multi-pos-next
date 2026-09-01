"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"

interface Props { from: string; to: string }

interface Row {
  date: string
  totalSales: number
  orderCount: number
  avgTicket: number
}

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`

export function DailyTrendReport({ from, to }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ report: "daily_trend" })
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    fetch(`/api/reports/bi?${params}`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [from, to])

  const maxSales = Math.max(...rows.map((r) => r.totalSales), 1)

  if (loading) return <div className="py-8 text-center text-muted-foreground">Cargando...</div>

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="size-4" /> Tendencia de Ventas Diarias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {rows.map((r) => (
              <div key={r.date} className="flex items-center gap-3">
                <span className="w-24 text-xs text-muted-foreground">{r.date.slice(5)}</span>
                <div className="flex-1">
                  <div className="h-4 overflow-hidden rounded bg-primary/20">
                    <div
                      className="h-full rounded bg-primary"
                      style={{ width: `${(r.totalSales / maxSales) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="w-20 text-right text-xs font-mono">{money(r.totalSales)}</span>
                <span className="w-12 text-right text-xs text-muted-foreground">{r.orderCount}</span>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="py-4 text-center text-muted-foreground">Sin datos</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
