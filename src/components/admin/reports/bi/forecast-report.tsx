"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp } from "lucide-react"

interface Props { from: string; to: string }

interface Row {
  date: string
  predictedSales: number
  confidence: number
}

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`

export function ForecastReport({ from: _from, to: _to }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch("/api/reports/bi?report=forecast&days=7")
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  const maxSales = Math.max(...rows.map((r) => r.predictedSales), 1)

  if (loading) return <div className="py-8 text-center text-muted-foreground">Cargando...</div>

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="size-4" /> Pronóstico de Ventas (7 días)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.date} className="flex items-center gap-3">
                <span className="w-24 text-xs text-muted-foreground">{r.date.slice(5)}</span>
                <div className="flex-1">
                  <div className="h-5 overflow-hidden rounded bg-primary/20">
                    <div
                      className="h-full rounded bg-primary"
                      style={{ width: `${(r.predictedSales / maxSales) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="w-20 text-right text-xs font-mono">{money(r.predictedSales)}</span>
                <Badge variant="secondary" className="w-14 justify-center text-[10px]">
                  {r.confidence}%
                </Badge>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="py-4 text-center text-muted-foreground">Sin datos para pronóstico</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
