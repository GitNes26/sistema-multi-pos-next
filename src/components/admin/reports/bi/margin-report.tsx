"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"

interface Props { from: string; to: string }

interface Row {
  categoryName: string
  revenue: number
  costOfGoods: number
  margin: number
  marginPct: number
}

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`

export function MarginReport({ from, to }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ report: "margin" })
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    fetch(`/api/reports/bi?${params}`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [from, to])

  const totalRevenue = rows.reduce((a, r) => a + r.revenue, 0)
  const totalCost = rows.reduce((a, r) => a + r.costOfGoods, 0)
  const totalMargin = totalRevenue - totalCost

  if (loading) return <div className="py-8 text-center text-muted-foreground">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{money(totalRevenue)}</div>
              <div className="text-xs text-muted-foreground">Ingresos totales</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{money(totalCost)}</div>
              <div className="text-xs text-muted-foreground">Costo de mercancía</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{money(totalMargin)}</div>
              <div className="text-xs text-muted-foreground">
                Margen ({totalRevenue > 0 ? ((totalMargin / totalRevenue) * 100).toFixed(1) : 0}%)
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="size-4" /> Margen por Categoría
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.categoryName} className="flex items-center gap-3">
                <span className="w-40 truncate text-sm font-medium">{r.categoryName}</span>
                <div className="flex-1">
                  <div className="h-4 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-green-500"
                      style={{ width: `${Math.min(100, r.marginPct)}%` }}
                    />
                  </div>
                </div>
                <span className="w-16 text-right text-sm font-mono">{r.marginPct.toFixed(1)}%</span>
                <span className="w-24 text-right text-sm font-mono text-green-600">{money(r.margin)}</span>
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
