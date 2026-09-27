"use client"

import { useState } from "react"
import { Gauge, Wand2 } from "lucide-react"
import { SegmentedFilter } from "@/components/base/segmented-filter"
import { StatusPill } from "@/components/base/status-pill"
import { Insights, Kpi, KpiGrid, ReportEmpty, ReportPanel, ReportState, ReportTable, SeriesChart, fmt, useBiReport } from "../report-kit"

interface Row { date: string; predictedSales: number; low: number; high: number; confidence: number; sampleSize: number }
interface Data { rows: Row[]; history: { date: string; total: number }[] }

const HORIZONS = [
  { value: "7", label: "7 días" },
  { value: "14", label: "14 días" },
  { value: "30", label: "30 días" },
]

const confidenceTone = (c: number): "success" | "primary" | "warning" | "danger" => c >= 65 ? "success" : c >= 40 ? "warning" : "danger"

export function ForecastReport() {
  const [days, setDays] = useState("7")
  const state = useBiReport<Data>("forecast", { days })

  return (
    <ReportState state={state}>
      {({ rows, history }) => {
        if (rows.length === 0) return <ReportEmpty icon={Wand2} title="Todavía no hay suficiente historial" hint="El pronóstico usa el promedio de cada día de la semana; se necesitan ventas de al menos una semana." />
        const total = rows.reduce((s, r) => s + r.predictedSales, 0)
        const avgConfidence = rows.reduce((s, r) => s + r.confidence, 0) / rows.length
        const chart = [
          ...history.map((h) => ({ date: h.date, real: h.total })),
          ...rows.map((r) => ({ date: r.date, forecast: r.predictedSales, high: r.high })),
        ]
        return (
          <>
            <KpiGrid cols={3}>
              <Kpi label={`Venta esperada (${days} días)`} value={fmt.money(total)} icon={Wand2} tone="primary" emphasis />
              <Kpi label="Promedio diario esperado" value={fmt.money(total / rows.length)} />
              <Kpi label="Confianza promedio" value={fmt.pct(avgConfidence, 0)} icon={Gauge} tone={confidenceTone(avgConfidence)} />
            </KpiGrid>

            <ReportPanel
              title="Historial y pronóstico"
              description="Ventas reales recientes y estimación de los próximos días."
              actions={<SegmentedFilter options={HORIZONS} value={days} onChange={setDays} ariaLabel="Horizonte" />}
            >
              <SeriesChart
                data={chart}
                xKey="date"
                xFormat={fmt.day}
                series={[
                  { key: "real", label: "Real", kind: "bar", color: "var(--muted-foreground)" },
                  { key: "forecast", label: "Pronóstico", kind: "bar" },
                  { key: "high", label: "Escenario alto", kind: "line", color: "var(--info)" },
                ]}
              />
            </ReportPanel>

            <Insights
              items={[
                avgConfidence < 50 && <>La confianza es baja porque hay pocas semanas de historial o la venta varía mucho; úsalo como referencia, no como meta.</>,
                <>El rango esperado por día va del <strong>escenario bajo</strong> al <strong>alto</strong> (± una desviación estándar de ese día de la semana).</>,
              ]}
            />

            <ReportPanel title="Detalle por día" flush>
              <ReportTable
                rows={rows}
                rowKey={(r) => r.date}
                columns={[
                  { key: "date", label: "Día", render: (r) => <span className="font-medium capitalize">{fmt.dayLong(r.date)}</span> },
                  { key: "range", label: "Rango", align: "right", value: (r) => r.low, render: (r) => <span className="text-muted-foreground">{fmt.money(r.low)} – {fmt.money(r.high)}</span>, hideOnMobile: true },
                  { key: "predictedSales", label: "Esperado", align: "right", bar: true, render: (r) => <strong>{fmt.money(r.predictedSales)}</strong> },
                  { key: "confidence", label: "Confianza", align: "right", render: (r) => <StatusPill tone={confidenceTone(r.confidence)}>{r.confidence}%</StatusPill> },
                  { key: "sampleSize", label: "Semanas", align: "right", render: (r) => fmt.int(r.sampleSize), hideOnMobile: true },
                ]}
              />
            </ReportPanel>
          </>
        )
      }}
    </ReportState>
  )
}
