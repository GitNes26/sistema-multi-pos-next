"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Award } from "lucide-react"

interface Props { from: string; to: string }

interface Row {
  employeeName: string
  totalSales: number
  saleCount: number
  avgTicket: number
  totalUnits: number
}

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`

export function EmployeeRankingReport({ from, to }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ report: "employee_ranking" })
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
            <Users className="size-4" /> Ranking de Empleados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">#</th>
                  <th className="pb-2 pr-4">Empleado</th>
                  <th className="pb-2 pr-4 text-right">Ventas</th>
                  <th className="pb-2 pr-4 text-right">Ticket Prom.</th>
                  <th className="pb-2 pr-4 text-right">Pedidos</th>
                  <th className="pb-2 text-right">Unidades</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.employeeName} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      {i < 3 ? (
                        <Badge variant={i === 0 ? "default" : "secondary"} className="text-xs">
                          <Award className="mr-1 size-3" />
                          {i + 1}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">{i + 1}</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 font-medium">{r.employeeName}</td>
                    <td className="py-2 pr-4 text-right font-mono">{money(r.totalSales)}</td>
                    <td className="py-2 pr-4 text-right font-mono">{money(r.avgTicket)}</td>
                    <td className="py-2 pr-4 text-right">{r.saleCount}</td>
                    <td className="py-2 text-right">{r.totalUnits}</td>
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
