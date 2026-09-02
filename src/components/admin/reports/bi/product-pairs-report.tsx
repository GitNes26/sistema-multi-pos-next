"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShoppingCart } from "lucide-react"

interface Props { from: string; to: string }

interface Row {
  productA: string
  productB: string
  timesTogether: number
  avgRevenue: number
}

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`

export function ProductPairsReport({ from, to }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ report: "product_pairs" })
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    fetch(`/api/reports/bi?${params}`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [from, to])

  const maxTimes = Math.max(...rows.map((r) => r.timesTogether), 1)

  if (loading) return <div className="py-8 text-center text-muted-foreground">Cargando...</div>

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShoppingCart className="size-4" /> Canasta de Mercado (Productos que se venden juntos)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-8 text-right text-sm font-mono text-muted-foreground">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{r.productA}</span>
                    <span className="text-muted-foreground">+</span>
                    <span className="font-medium">{r.productB}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(r.timesTogether / maxTimes) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="w-16 text-right text-sm font-mono">{r.timesTogether}x</span>
                <span className="w-20 text-right text-sm font-mono text-muted-foreground">{money(r.avgRevenue)}</span>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="py-4 text-center text-muted-foreground">Sin datos de canasta</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
