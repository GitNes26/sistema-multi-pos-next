"use client"

import { PackageCheck, PackageX, Target } from "lucide-react"
import { BarList, Insights, Kpi, KpiGrid, ReportEmpty, ReportPanel, ReportState, fmt, useBiReport } from "../report-kit"

interface Row { locationName: string; totalProducts: number; inStock: number; outOfStock: number; fillRate: number }
interface Data { rows: Row[]; totals: { totalProducts: number; inStock: number; outOfStock: number; fillRate: number } }

const tone = (r: number): "success" | "primary" | "warning" | "danger" => r >= 90 ? "success" : r >= 75 ? "warning" : "danger"

export function FillRateReport() {
  const state = useBiReport<Data>("fill_rate")

  return (
    <ReportState state={state} kpis={3}>
      {({ rows, totals: t }) => {
        if (rows.length === 0) return <ReportEmpty icon={Target} hint="No hay registros de inventario." />
        return (
          <>
            <KpiGrid cols={3}>
              <Kpi label="Disponibilidad general" value={fmt.pct(t.fillRate)} icon={Target} tone={tone(t.fillRate)} emphasis />
              <Kpi label="Con existencia" value={fmt.int(t.inStock)} icon={PackageCheck} tone="success" hint={`de ${fmt.int(t.totalProducts)}`} />
              <Kpi label="Sin existencia" value={fmt.int(t.outOfStock)} icon={PackageX} tone={t.outOfStock > 0 ? "danger" : "default"} />
            </KpiGrid>

            <ReportPanel title="Disponibilidad por ubicación" description="Porcentaje del catálogo con existencia mayor a cero. Meta sugerida: 90 % o más.">
              <BarList
                max={100}
                items={rows.map((r) => ({
                  label: r.locationName,
                  value: r.fillRate,
                  display: fmt.pct(r.fillRate),
                  secondary: `${fmt.int(r.inStock)} con existencia · ${fmt.int(r.outOfStock)} agotados`,
                  tone: tone(r.fillRate),
                }))}
              />
            </ReportPanel>

            <Insights
              items={[
                rows[0].fillRate < 90 && (
                  <><strong>{rows[0].locationName}</strong> tiene la menor disponibilidad ({fmt.pct(rows[0].fillRate)}): revisa el reporte de Stock bajo o una transferencia desde otra ubicación.</>
                ),
              ]}
            />
          </>
        )
      }}
    </ReportState>
  )
}
