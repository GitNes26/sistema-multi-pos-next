"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRightLeft } from "lucide-react"

interface Props { from: string; to: string }

interface Row {
  id: string
  fromLocation: string
  toLocation: string
  status: string
  itemCount: number
  totalQty: number
  createdAt: string
}

const statusColor = (s: string) => {
  if (s === "completed") return "bg-green-100 text-green-800"
  if (s === "in_transit") return "bg-blue-100 text-blue-800"
  if (s === "cancelled") return "bg-red-100 text-red-800"
  return "bg-gray-100 text-gray-800"
}

export function TransfersReport({ from, to }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ report: "transfers" })
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
            <ArrowRightLeft className="size-4" /> Transferencias CEDIS ↔ Sucursales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Origen</th>
                  <th className="pb-2 pr-4">Destino</th>
                  <th className="pb-2 pr-4">Estado</th>
                  <th className="pb-2 pr-4 text-right">Items</th>
                  <th className="pb-2 pr-4 text-right">Cantidad</th>
                  <th className="pb-2 text-right">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{r.fromLocation}</td>
                    <td className="py-2 pr-4">{r.toLocation}</td>
                    <td className="py-2 pr-4">
                      <Badge variant="secondary" className={statusColor(r.status)}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4 text-right">{r.itemCount}</td>
                    <td className="py-2 pr-4 text-right font-mono">{r.totalQty}</td>
                    <td className="py-2 text-right text-muted-foreground">{r.createdAt}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">Sin transferencias</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
