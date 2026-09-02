"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { UserCheck } from "lucide-react"

interface Props { from: string; to: string }

interface Row {
  employeeName: string
  totalRevenue: number
  totalCost: number
  margin: number
  marginPct: number
  saleCount: number
}

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`

export function EmployeeMarginReport({ from, to }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ report: "employee_margin" })
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
            <UserCheck className="size-4" /> Margen por Empleado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Empleado</th>
                  <th className="pb-2 pr-4 text-right">Ingresos</th>
                  <th className="pb-2 pr-4 text-right">Costo</th>
                  <th className="pb-2 pr-4 text-right">Margen</th>
                  <th className="pb-2 pr-4 text-right">Margen %</th>
                  <th className="pb-2 text-right">Ventas</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.employeeName} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{r.employeeName}</td>
                    <td className="py-2 pr-4 text-right font-mono">{money(r.totalRevenue)}</td>
                    <td className="py-2 pr-4 text-right font-mono text-orange-600">{money(r.totalCost)}</td>
                    <td className="py-2 pr-4 text-right font-mono text-green-600">{money(r.margin)}</td>
                    <td className="py-2 pr-4 text-right">
                      <Badge variant={r.marginPct >= 30 ? "default" : "secondary"}>
                        {r.marginPct.toFixed(1)}%
                      </Badge>
                    </td>
                    <td className="py-2 text-right">{r.saleCount}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">Sin datos</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
