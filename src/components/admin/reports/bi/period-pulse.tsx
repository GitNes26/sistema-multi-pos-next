"use client"

import { Percent, Receipt, ShoppingBag, Tag, TrendingUp, Users } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Kpi, KpiGrid, delta, fmt, useBiReport } from "../report-kit"

interface Totals {
  sales: number
  tickets: number
  avgTicket: number
  units: number
  grossMargin: number
  marginPct: number
  discounts: number
  refunds: number
  customers: number
}

interface Summary {
  current: Totals
  previous: Totals
  previousRange: { from: string; to: string }
}

// Pulso del periodo: los indicadores clave del negocio, con su variación
// contra un periodo anterior de la misma duración. Encabeza todos los reportes.
export function PeriodPulse() {
  const { data, loading } = useBiReport<Summary>("summary")

  if (!data) {
    return (
      <KpiGrid cols={6}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[6.5rem] rounded-2xl" />
        ))}
      </KpiGrid>
    )
  }

  const { current: c, previous: p } = data
  const vs = `vs ${fmt.day(data.previousRange.from)} – ${fmt.day(data.previousRange.to)}`

  return (
    <section aria-label="Pulso del periodo" className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
      <KpiGrid cols={6}>
        <Kpi label="Ventas" value={fmt.money(c.sales)} icon={TrendingUp} tone="primary" delta={delta(c.sales, p.sales)} hint={vs} emphasis />
        <Kpi label="Tickets" value={fmt.int(c.tickets)} icon={Receipt} delta={delta(c.tickets, p.tickets)} />
        <Kpi label="Ticket promedio" value={fmt.money(c.avgTicket)} icon={ShoppingBag} delta={delta(c.avgTicket, p.avgTicket)} />
        <Kpi
          label="Margen bruto"
          value={fmt.pct(c.marginPct)}
          icon={Percent}
          tone="success"
          delta={delta(c.grossMargin, p.grossMargin)}
          hint={fmt.money(c.grossMargin)}
        />
        <Kpi label="Clientes" value={fmt.int(c.customers)} icon={Users} tone="info" delta={delta(c.customers, p.customers)} />
        <Kpi
          label="Descuentos"
          value={fmt.money(c.discounts)}
          icon={Tag}
          tone="warning"
          delta={delta(c.discounts, p.discounts)}
          inverse
          hint={c.refunds > 0 ? `Devoluciones ${fmt.money(c.refunds)}` : undefined}
        />
      </KpiGrid>
    </section>
  )
}
