"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Star } from "lucide-react"

interface Props { from: string; to: string }

interface Row {
  customerId: string
  customerName: string
  totalPoints: number
  totalSpent: number
  orderCount: number
  lastOrderDate: string | null
}

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`

export function LoyaltyReport({ from, to }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ report: "loyalty" })
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
            <Star className="size-4" /> Programa de Lealtad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="rounded-lg bg-muted p-3 text-center">
              <div className="text-2xl font-bold">{rows.length}</div>
              <div className="text-xs text-muted-foreground">Clientes activos</div>
            </div>
            <div className="rounded-lg bg-muted p-3 text-center">
              <div className="text-2xl font-bold">{rows.reduce((a, r) => a + r.totalPoints, 0).toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Puntos acumulados</div>
            </div>
            <div className="rounded-lg bg-muted p-3 text-center">
              <div className="text-2xl font-bold">{money(rows.reduce((a, r) => a + r.totalSpent, 0))}</div>
              <div className="text-xs text-muted-foreground">Total gastado</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Cliente</th>
                  <th className="pb-2 pr-4 text-right">Puntos</th>
                  <th className="pb-2 pr-4 text-right">Gastado</th>
                  <th className="pb-2 pr-4 text-right">Pedidos</th>
                  <th className="pb-2 text-right">Último pedido</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.customerId} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{r.customerName}</td>
                    <td className="py-2 pr-4 text-right font-mono text-amber-600">{r.totalPoints.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right font-mono">{money(r.totalSpent)}</td>
                    <td className="py-2 pr-4 text-right">{r.orderCount}</td>
                    <td className="py-2 text-right text-muted-foreground">{r.lastOrderDate ?? "-"}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">Sin datos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
