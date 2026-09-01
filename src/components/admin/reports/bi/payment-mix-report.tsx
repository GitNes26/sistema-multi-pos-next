"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard } from "lucide-react"

interface Props { from: string; to: string }

interface Row {
  method: string
  count: number
  total: number
  pct: number
}

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`

const METHOD_COLORS: Record<string, string> = {
  cash: "bg-green-500",
  card: "bg-blue-500",
  credit: "bg-orange-500",
  points: "bg-purple-500",
  other: "bg-gray-400",
}

export function PaymentMixReport({ from, to }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ report: "payment_mix" })
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
            <CreditCard className="size-4" /> Mix de Métodos de Pago
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.method} className="flex items-center gap-3">
                <span className="w-24 text-sm font-medium capitalize">{r.method}</span>
                <div className="flex-1">
                  <div className="h-6 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${METHOD_COLORS[r.method] ?? "bg-gray-400"}`}
                      style={{ width: `${r.pct}%` }}
                    />
                  </div>
                </div>
                <span className="w-16 text-right text-sm font-mono">{r.pct.toFixed(1)}%</span>
                <span className="w-20 text-right text-sm font-mono">{money(r.total)}</span>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="py-4 text-center text-muted-foreground">Sin datos</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
