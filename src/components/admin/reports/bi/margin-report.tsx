"use client"

import { Percent, TrendingUp, Wallet, AlertTriangle } from "lucide-react"
import { BarList, Insights, Kpi, KpiGrid, ReportEmpty, ReportPanel, ReportState, ReportTable, fmt, useBiReport } from "../report-kit"

interface Row { categoryName: string; revenue: number; costOfGoods: number; margin: number; marginPct: number; units: number }
interface Data { rows: Row[]; missingCost: number; itemCount: number }

const tone = (pct: number): "success" | "primary" | "warning" | "danger" => pct >= 40 ? "success" : pct >= 20 ? "primary" : pct >= 0 ? "warning" : "danger"

export function MarginReport() {
  const state = useBiReport<Data>("margin")

  return (
    <ReportState state={state}>
      {({ rows, missingCost, itemCount }) => {
        if (rows.length === 0) return <ReportEmpty icon={TrendingUp} hint="No hay ventas completadas en el periodo." />
        const revenue = rows.reduce((s, r) => s + r.revenue, 0)
        const cost = rows.reduce((s, r) => s + r.costOfGoods, 0)
        const margin = revenue - cost
        const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0
        const byPct = [...rows].sort((a, b) => a.marginPct - b.marginPct)
        return (
          <>
            <KpiGrid>
              <Kpi label="Ingresos" value={fmt.money(revenue)} icon={Wallet} />
              <Kpi label="Costo de lo vendido" value={fmt.money(cost)} tone="warning" />
              <Kpi label="Margen bruto" value={fmt.money(margin)} icon={TrendingUp} tone="success" emphasis />
              <Kpi label="Margen %" value={fmt.pct(marginPct)} icon={Percent} tone={tone(marginPct)} />
            </KpiGrid>

            {missingCost > 0 && (
              <p className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-ink">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {fmt.int(missingCost)} de {fmt.int(itemCount)} partidas vendidas no tienen costo capturado; su margen aparece al 100 %. Registra el costo en Productos para un cálculo exacto.
              </p>
            )}

            <ReportPanel title="Margen por categoría" description="Porcentaje de ganancia sobre el ingreso.">
              <BarList
                max={100}
                items={[...rows].sort((a, b) => b.margin - a.margin).map((r) => ({
                  label: r.categoryName,
                  value: Math.max(0, r.marginPct),
                  display: fmt.pct(r.marginPct),
                  secondary: `${fmt.money(r.margin)} de ${fmt.money(r.revenue)}`,
                  tone: tone(r.marginPct),
                }))}
              />
            </ReportPanel>

            <Insights
              items={[
                <><strong>{rows[0].categoryName}</strong> es la categoría que más ganancia aporta ({fmt.money(rows[0].margin)}).</>,
                byPct.length > 1 && byPct[0].marginPct < 20 && (
                  <><strong>{byPct[0].categoryName}</strong> deja solo {fmt.pct(byPct[0].marginPct)}: revisa precios o costos de proveedor.</>
                ),
              ]}
            />

            <ReportPanel title="Detalle" flush>
              <ReportTable
                rows={rows}
                rowKey={(r) => r.categoryName}
                defaultSort={{ key: "margin", dir: "desc" }}
                columns={[
                  { key: "categoryName", label: "Categoría", render: (r) => <span className="font-medium">{r.categoryName}</span> },
                  { key: "units", label: "Unidades", align: "right", render: (r) => fmt.num(r.units), hideOnMobile: true },
                  { key: "revenue", label: "Ingresos", align: "right", render: (r) => fmt.money(r.revenue) },
                  { key: "costOfGoods", label: "Costo", align: "right", render: (r) => fmt.money(r.costOfGoods), hideOnMobile: true },
                  { key: "marginPct", label: "Margen %", align: "right", render: (r) => fmt.pct(r.marginPct) },
                  { key: "margin", label: "Margen", align: "right", bar: true, render: (r) => <strong>{fmt.money(r.margin)}</strong> },
                ]}
              />
            </ReportPanel>
          </>
        )
      }}
    </ReportState>
  )
}
