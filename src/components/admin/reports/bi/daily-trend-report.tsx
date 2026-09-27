"use client"

import { CalendarDays, TrendingUp } from "lucide-react"
import { Insights, Kpi, KpiGrid, ReportPanel, ReportState, ReportTable, SeriesChart, fmt, useBiReport } from "../report-kit"

interface Row { date: string; totalSales: number; orderCount: number; avgTicket: number }

const DOW = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]

export function DailyTrendReport() {
  const state = useBiReport<{ rows: Row[] }>("daily_trend")

  return (
    <ReportState state={state}>
      {({ rows }) => {
        const withSales = rows.filter((r) => r.orderCount > 0)
        const total = rows.reduce((s, r) => s + r.totalSales, 0)
        const tickets = rows.reduce((s, r) => s + r.orderCount, 0)
        const best = withSales.reduce<Row | null>((b, r) => (!b || r.totalSales > b.totalSales ? r : b), null)
        const avgDay = rows.length ? total / rows.length : 0

        // Promedio por día de la semana para detectar el día fuerte y el débil.
        const byDow = Array.from({ length: 7 }, () => ({ total: 0, days: 0 }))
        for (const r of rows) {
          const d = new Date(`${r.date}T12:00:00`).getDay()
          byDow[d].total += r.totalSales
          byDow[d].days += 1
        }
        const dowAvg = byDow.map((d, i) => ({ i, avg: d.days ? d.total / d.days : 0 })).filter((d) => byDow[d.i].days > 0)
        const strong = dowAvg.reduce((a, b) => (b.avg > a.avg ? b : a), dowAvg[0])
        const weak = dowAvg.reduce((a, b) => (b.avg < a.avg ? b : a), dowAvg[0])

        const half = Math.floor(rows.length / 2)
        const first = rows.slice(0, half).reduce((s, r) => s + r.totalSales, 0)
        const second = rows.slice(half).reduce((s, r) => s + r.totalSales, 0)
        const trend = first > 0 ? ((second - first) / first) * 100 : null

        return (
          <>
            <KpiGrid>
              <Kpi label="Venta del periodo" value={fmt.money(total)} icon={TrendingUp} tone="primary" emphasis />
              <Kpi label="Promedio diario" value={fmt.money(avgDay)} hint={`${rows.length} días`} />
              <Kpi label="Días con venta" value={`${withSales.length} / ${rows.length}`} icon={CalendarDays} />
              <Kpi label="Mejor día" value={best ? fmt.money(best.totalSales) : "—"} hint={best ? fmt.day(best.date) : undefined} tone="success" />
            </KpiGrid>

            <ReportPanel title="Ventas por día" description="Importe vendido y número de tickets, incluidos los días sin venta.">
              <SeriesChart
                data={rows}
                xKey="date"
                xFormat={fmt.day}
                series={[
                  { key: "totalSales", label: "Ventas" },
                  { key: "orderCount", label: "Tickets", kind: "line", color: "var(--info)", right: true },
                ]}
              />
            </ReportPanel>

            <Insights
              items={[
                trend != null && Math.abs(trend) >= 1 && (
                  <>La segunda mitad del periodo vendió <strong>{fmt.pct(Math.abs(trend), 0)} {trend > 0 ? "más" : "menos"}</strong> que la primera.</>
                ),
                strong && weak && strong.i !== weak.i && (
                  <>El <strong>{DOW[strong.i]}</strong> es el día más fuerte ({fmt.money(strong.avg)} en promedio) y el <strong>{DOW[weak.i]}</strong> el más débil ({fmt.money(weak.avg)}).</>
                ),
                tickets > 0 && <>Ticket promedio del periodo: <strong>{fmt.money(total / tickets)}</strong>.</>,
              ]}
            />

            <ReportPanel title="Detalle diario" flush>
              <ReportTable
                rows={[...rows].reverse()}
                rowKey={(r) => r.date}
                limit={14}
                columns={[
                  { key: "date", label: "Día", render: (r) => <span className="font-medium capitalize">{fmt.dayLong(r.date)}</span> },
                  { key: "orderCount", label: "Tickets", align: "right", render: (r) => fmt.int(r.orderCount) },
                  { key: "avgTicket", label: "Ticket promedio", align: "right", render: (r) => fmt.money(r.avgTicket), hideOnMobile: true },
                  { key: "totalSales", label: "Ventas", align: "right", bar: true, render: (r) => <strong>{fmt.money(r.totalSales)}</strong> },
                ]}
              />
            </ReportPanel>
          </>
        )
      }}
    </ReportState>
  )
}
