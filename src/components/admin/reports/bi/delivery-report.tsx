"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Truck } from "lucide-react"

interface Props { from: string; to: string }

interface Row {
  locationName: string
  totalOrders: number
  avgPrepMinutes: number
  avgDeliveryMinutes: number
  onTimeRate: number
  cancelRate: number
}

export function DeliveryReport({ from, to }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ report: "delivery" })
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    fetch(`/api/reports/bi?${params}`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [from, to])

  if (loading) return <div className="py-8 text-center text-muted-foreground">Cargando...</div>

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Truck className="size-4" /> Performance de Delivery
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Sucursal</th>
                  <th className="pb-2 pr-4 text-right">Pedidos</th>
                  <th className="pb-2 pr-4 text-right">Cancelados</th>
                  <th className="pb-2 text-right">Tasa cancelación</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.locationName} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{r.locationName}</td>
                    <td className="py-2 pr-4 text-right">{r.totalOrders}</td>
                    <td className="py-2 pr-4 text-right">{Math.round(r.totalOrders * r.cancelRate / 100)}</td>
                    <td className="py-2 text-right">
                      <span className={r.cancelRate > 10 ? "text-red-600 font-medium" : "text-muted-foreground"}>
                        {r.cancelRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">Sin pedidos de delivery</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
