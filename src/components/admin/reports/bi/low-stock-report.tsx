"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle } from "lucide-react"

interface Row {
  productId: string
  productName: string
  locationName: string
  currentStock: number
  minStock: number
  maxStock: number
  deficit: number
}

export function LowStockReport({ from: _from, to: _to }: { from: string; to: string }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch("/api/reports/bi?report=low_stock")
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
            <AlertTriangle className="size-4 text-orange-500" />
            Alertas de Stock Bajo
            {rows.length > 0 && <Badge variant="destructive" className="ml-2">{rows.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Producto</th>
                  <th className="pb-2 pr-4">Sucursal</th>
                  <th className="pb-2 pr-4 text-right">Stock</th>
                  <th className="pb-2 pr-4 text-right">Mínimo</th>
                  <th className="pb-2 text-right">Déficit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.productId}-${r.locationName}`} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{r.productName}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{r.locationName}</td>
                    <td className="py-2 pr-4 text-right font-mono">{r.currentStock}</td>
                    <td className="py-2 pr-4 text-right font-mono text-muted-foreground">{r.minStock}</td>
                    <td className="py-2 text-right">
                      <Badge variant="destructive">-{r.deficit}</Badge>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center text-green-600">✓ Todo en_stock</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
