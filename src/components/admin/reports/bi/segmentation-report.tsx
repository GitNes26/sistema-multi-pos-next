"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users } from "lucide-react"

interface Row {
  segmentType: string
  customerCount: number
  avgSpent: number
  avgOrders: number
}

const money = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`

const segmentColor = (seg: string) => {
  if (seg.toLowerCase().includes("vip")) return "bg-amber-100 text-amber-800"
  if (seg.toLowerCase().includes("risk")) return "bg-red-100 text-red-800"
  if (seg.toLowerCase().includes("dormant")) return "bg-gray-100 text-gray-800"
  return "bg-blue-100 text-blue-800"
}

export function SegmentationReport({ from: _from, to: _to }: { from: string; to: string }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch("/api/reports/bi?report=segmentation")
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
            <Users className="size-4" /> Segmentación de Clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {rows.map((r) => (
              <div key={r.segmentType} className="rounded-lg border p-4 text-center">
                <Badge variant="secondary" className={`mb-2 ${segmentColor(r.segmentType)}`}>
                  {r.segmentType}
                </Badge>
                <div className="text-2xl font-bold">{r.customerCount}</div>
                <div className="text-xs text-muted-foreground">clientes</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Prom: {money(r.avgSpent)}
                </div>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="col-span-full py-4 text-center text-muted-foreground">Sin segmentos definidos</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
