"use client"

import { Clock, Flame, Moon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Insights, Kpi, KpiGrid, ReportEmpty, ReportPanel, ReportState, SeriesChart, fmt, useBiReport } from "../report-kit"

interface Cell { dayOfWeek: number; hour: number; sales: number; count: number }
interface Data {
  grid: Cell[][]
  peak: Cell | null
  byDay: { dayOfWeek: number; sales: number; count: number }[]
  byHour: { hour: number; sales: number; count: number }[]
  totalCount: number
}

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const DAYS_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]
// Lunes primero, como se lee una semana de trabajo.
const ROW_ORDER = [1, 2, 3, 4, 5, 6, 0]
const hourLabel = (h: number) => `${h}:00`

// Escala de 5 pasos sobre el color de la empresa.
const LEVELS = ["bg-muted", "bg-primary/15", "bg-primary/35", "bg-primary/60", "bg-primary"]

export function HeatmapReport() {
  const state = useBiReport<Data>("heatmap")

  return (
    <ReportState state={state}>
      {(data) => {
        if (data.totalCount === 0) return <ReportEmpty icon={Clock} hint="No hay ventas completadas en el periodo." />
        // Solo las horas con actividad (más una de margen), para no mostrar la madrugada vacía.
        const active = data.byHour.filter((h) => h.count > 0).map((h) => h.hour)
        const start = Math.max(0, Math.min(...active) - 1)
        const end = Math.min(23, Math.max(...active) + 1)
        const hours = Array.from({ length: end - start + 1 }, (_, i) => start + i)
        const max = Math.max(...data.grid.flat().map((c) => c.sales), 1)
        const level = (v: number) => (v <= 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)))
        const busiestDay = [...data.byDay].sort((a, b) => b.sales - a.sales)[0]
        const quietHour = data.byHour.filter((h) => h.hour >= start && h.hour <= end && h.count > 0).sort((a, b) => a.sales - b.sales)[0]
        const topHours = [...data.byHour].sort((a, b) => b.sales - a.sales).slice(0, 3)
        const topShare = topHours.reduce((s, h) => s + h.sales, 0) / Math.max(1, data.byHour.reduce((s, h) => s + h.sales, 0))

        return (
          <>
            <KpiGrid cols={3}>
              <Kpi label="Momento pico" value={data.peak ? <span className="capitalize">{`${DAYS_LONG[data.peak.dayOfWeek]} ${hourLabel(data.peak.hour)}`}</span> : "—"} hint={data.peak ? fmt.money(data.peak.sales) : undefined} icon={Flame} tone="primary" emphasis />
              <Kpi label="Día más fuerte" value={<span className="capitalize">{DAYS_LONG[busiestDay.dayOfWeek]}</span>} hint={fmt.money(busiestDay.sales)} icon={Clock} />
              <Kpi label="Hora más tranquila" value={quietHour ? hourLabel(quietHour.hour) : "—"} hint={quietHour ? `${fmt.int(quietHour.count)} tickets` : undefined} icon={Moon} tone="info" />
            </KpiGrid>

            <ReportPanel title="Mapa de calor" description="Venta por día de la semana y hora. El número es la cantidad de tickets.">
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-1 text-xs">
                  <thead>
                    <tr>
                      <th className="w-10" />
                      {hours.map((h) => (
                        <th key={h} scope="col" className="px-0.5 pb-1 text-center font-medium text-muted-foreground tabular-nums">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ROW_ORDER.map((dow) => (
                      <tr key={dow}>
                        <th scope="row" className="pr-1 text-left font-medium text-muted-foreground">{DAYS[dow]}</th>
                        {hours.map((h) => {
                          const cell = data.grid[dow][h]
                          const lv = level(cell.sales)
                          return (
                            <td key={h} className="p-0">
                              <div
                                title={`${DAYS_LONG[dow]} ${hourLabel(h)} · ${fmt.money(cell.sales)} · ${cell.count} tickets`}
                                className={cn(
                                  "flex h-9 min-w-8 items-center justify-center rounded-md font-semibold tabular-nums transition-transform hover:scale-110",
                                  LEVELS[lv],
                                  lv >= 3 ? "text-primary-foreground" : "text-foreground/70"
                                )}
                              >
                                {cell.count > 0 ? cell.count : ""}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Menos</span>
                {LEVELS.map((c) => <span key={c} className={cn("size-3.5 rounded", c)} />)}
                <span>Más</span>
              </div>
            </ReportPanel>

            <ReportPanel title="Venta por hora" description="Suma de todos los días del periodo.">
              <SeriesChart
                data={data.byHour.filter((h) => h.hour >= start && h.hour <= end)}
                xKey="hour"
                xFormat={(v) => hourLabel(Number(v))}
                height={220}
                series={[{ key: "sales", label: "Ventas", kind: "bar" }]}
              />
            </ReportPanel>

            <Insights
              items={[
                <>Las 3 horas más fuertes ({topHours.map((h) => hourLabel(h.hour)).join(", ")}) concentran el <strong>{fmt.pct(topShare * 100, 0)}</strong> de la venta: conviene reforzar personal y caja en ese horario.</>,
                quietHour && <>A las <strong>{hourLabel(quietHour.hour)}</strong> la venta es mínima: buen momento para reabasto, limpieza o una promoción de hora tranquila.</>,
              ]}
            />
          </>
        )
      }}
    </ReportState>
  )
}
