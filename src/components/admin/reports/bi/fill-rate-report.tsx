"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package } from "lucide-react"

interface Row {
  locationName: string
  totalProducts: number
  inStock: number
  outOfStock: number
  fillRate: number
}

export function FillRateReport({ from: _from, to: _to }: { from: string; to: string }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch("/api/reports/bi?report=fill_rate")
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-8 text-center text-muted-foreground">Cargando...</div>

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Package className="size-4" /> Fill Rate por Sucursal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.locationName} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{r.locationName}</span>
                  <span className={r.fillRate < 80 ? "text-red-600 font-bold" : "text-muted-foreground"}>
                    {r.fillRate.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${r.fillRate >= 90 ? "bg-green-500" : r.fillRate >= 70 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${r.fillRate}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{r.inStock}/{r.totalProducts} productos con stock</span>
                  <span>{r.outOfStock} sin stock</span>
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="py-4 text-center text-muted-foreground">Sin datos de inventario</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
