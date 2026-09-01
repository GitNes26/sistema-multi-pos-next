"use client"

import { useEffect, useState } from "react"
import { Loader2, TrendingUp, Globe, Store, ArrowRightLeft } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { money } from "@/lib/pos/money"

interface Row {
  locationName: string
  posSales: number
  portalSales: number
  total: number
  pctWeb: number
  aovPos: number
  aovPortal: number
}

interface Props { from?: string; to?: string; locationId?: string }

export function OmnichannelReport({ from, to, locationId }: Props) {
  const [data, setData] = useState<{ rows: Row[]; totals: { posSales: number; portalSales: number; total: number; pctWeb: number } } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ report: "omnichannel" })
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    if (locationId) params.set("locationId", locationId)
    fetch(`/api/reports/bi?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [from, to, locationId])

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  if (!data) return <p className="py-10 text-center text-muted-foreground">Sin datos</p>

  const maxTotal = Math.max(...data.rows.map((r) => r.total), 1)

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="size-3" /> Venta Total</div>
            <p className="mt-1 text-xl font-black tabular-nums">{money(data.totals.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Store className="size-3" /> POS Físico</div>
            <p className="mt-1 text-xl font-black tabular-nums">{money(data.totals.posSales)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Globe className="size-3" /> Portal Web</div>
            <p className="mt-1 text-xl font-black tabular-nums">{money(data.totals.portalSales)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><ArrowRightLeft className="size-3" /> % Web</div>
            <p className="mt-1 text-xl font-black tabular-nums">{data.totals.pctWeb}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart + Table */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Ventas por sucursal</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.rows.map((r) => (
              <div key={r.locationName} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{r.locationName}</span>
                  <span className="tabular-nums">{money(r.total)} <span className="text-muted-foreground">({r.pctWeb}% web)</span></span>
                </div>
                <div className="flex h-5 overflow-hidden rounded-full bg-muted">
                  <div className="bg-emerald-500 transition-all" style={{ width: `${(r.posSales / maxTotal) * 100}%` }} />
                  <div className="bg-blue-500 transition-all" style={{ width: `${(r.portalSales / maxTotal) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500" /> POS</span>
            <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-blue-500" /> Portal</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
