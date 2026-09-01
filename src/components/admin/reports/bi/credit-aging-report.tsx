"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle } from "lucide-react"

interface Row {
  customerId: string
  customerName: string
  balance: number
  creditLimit: number | null
  oldestDebtDate: string | null
  daysOverdue: number
  agingBucket: string
}

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`

const bucketColor = (bucket: string) => {
  if (bucket === "Current") return "bg-green-100 text-green-800"
  if (bucket.includes("30")) return "bg-yellow-100 text-yellow-800"
  if (bucket.includes("60")) return "bg-orange-100 text-orange-800"
  return "bg-red-100 text-red-800"
}

export function CreditAgingReport({ from: _from, to: _to }: { from: string; to: string }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch("/api/reports/bi?report=credit_aging")
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  const totalDebt = rows.reduce((a, r) => a + r.balance, 0)
  const overLimit = rows.filter((r) => r.creditLimit != null && r.balance > r.creditLimit)

  if (loading) return <div className="py-8 text-center text-muted-foreground">Cargando...</div>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{money(totalDebt)}</div>
              <div className="text-xs text-muted-foreground">Cartera total</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{rows.length}</div>
              <div className="text-xs text-muted-foreground">Clientes con deuda</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{overLimit.length}</div>
              <div className="text-xs text-muted-foreground">Sobre límite</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="size-4" /> Antigüedad de Saldos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Cliente</th>
                  <th className="pb-2 pr-4 text-right">Saldo</th>
                  <th className="pb-2 pr-4 text-right">Límite</th>
                  <th className="pb-2 pr-4 text-right">Días</th>
                  <th className="pb-2 text-right">Segmento</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.customerId} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{r.customerName}</td>
                    <td className="py-2 pr-4 text-right font-mono text-red-600">{money(r.balance)}</td>
                    <td className="py-2 pr-4 text-right font-mono text-muted-foreground">{r.creditLimit != null ? money(r.creditLimit) : "-"}</td>
                    <td className="py-2 pr-4 text-right">{r.daysOverdue}</td>
                    <td className="py-2 text-right">
                      <Badge variant="secondary" className={bucketColor(r.agingBucket)}>
                        {r.agingBucket}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">Sin deuda pendiente</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
