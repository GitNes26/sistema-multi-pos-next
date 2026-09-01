"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tag } from "lucide-react"

interface Props { from: string; to: string }

interface Row {
  promotionId: string
  promotionName: string
  discountGiven: number
  ordersCount: number
  revenueGenerated: number
  roi: number
}

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`

export function PromosRoiReport({ from, to }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ report: "promos_roi" })
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    fetch(`/api/reports/bi?${params}`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [from, to])

  const totalDiscount = rows.reduce((a, r) => a + r.discountGiven, 0)
  const totalRevenue = rows.reduce((a, r) => a + r.revenueGenerated, 0)

  if (loading) return <div className="py-8 text-center text-muted-foreground">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{rows.length}</div>
              <div className="text-xs text-muted-foreground">Promociones activas</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{money(totalDiscount)}</div>
              <div className="text-xs text-muted-foreground">Descuento total</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{money(totalRevenue)}</div>
              <div className="text-xs text-muted-foreground">Ingresos generados</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Tag className="size-4" /> ROI por Promoción
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Promoción</th>
                  <th className="pb-2 pr-4 text-right">Descuento</th>
                  <th className="pb-2 pr-4 text-right">Ingresos</th>
                  <th className="pb-2 pr-4 text-right">Pedidos</th>
                  <th className="pb-2 text-right">ROI</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.promotionId} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{r.promotionName}</td>
                    <td className="py-2 pr-4 text-right font-mono text-red-600">{money(r.discountGiven)}</td>
                    <td className="py-2 pr-4 text-right font-mono text-green-600">{money(r.revenueGenerated)}</td>
                    <td className="py-2 pr-4 text-right">{r.ordersCount}</td>
                    <td className="py-2 text-right">
                      <Badge variant={r.roi >= 100 ? "default" : "secondary"}>
                        {r.roi.toFixed(0)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">Sin promociones</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
