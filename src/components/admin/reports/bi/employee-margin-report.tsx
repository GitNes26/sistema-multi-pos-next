"use client"

import { Percent, TrendingUp, UserCheck } from "lucide-react"
import { BarList, Kpi, KpiGrid, ReportEmpty, ReportPanel, ReportState, ReportTable, fmt, useBiReport } from "../report-kit"

interface Row { employeeName: string; totalRevenue: number; totalCost: number; margin: number; marginPct: number; saleCount: number; marginPerSale: number }

export function EmployeeMarginReport() {
  const state = useBiReport<{ rows: Row[] }>("employee_margin")

  return (
    <ReportState state={state} kpis={3}>
      {({ rows }) => {
        if (rows.length === 0) return <ReportEmpty icon={UserCheck} hint="No hay ventas completadas en el periodo." />
        const margin = rows.reduce((s, r) => s + r.margin, 0)
        const revenue = rows.reduce((s, r) => s + r.totalRevenue, 0)
        const bestPerSale = [...rows].sort((a, b) => b.marginPerSale - a.marginPerSale)[0]
        return (
          <>
            <KpiGrid cols={3}>
              <Kpi label="Margen generado" value={fmt.money(margin)} icon={TrendingUp} tone="success" emphasis />
              <Kpi label="Margen % del equipo" value={fmt.pct(revenue ? (margin / revenue) * 100 : 0)} icon={Percent} />
              <Kpi label="Mayor margen por venta" value={fmt.money(bestPerSale.marginPerSale)} icon={UserCheck} tone="primary" hint={bestPerSale.employeeName} />
            </KpiGrid>

            <ReportPanel title="Ganancia atribuida" description="Margen bruto de las ventas cobradas por cada persona.">
              <BarList
                items={rows.map((r) => ({
                  label: r.employeeName,
                  value: r.margin,
                  display: fmt.money(r.margin),
                  secondary: `${fmt.pct(r.marginPct)} de margen · ${fmt.int(r.saleCount)} ventas`,
                  tone: "success",
                }))}
              />
            </ReportPanel>

            <ReportPanel title="Detalle" flush>
              <ReportTable
                rows={rows}
                rowKey={(r) => r.employeeName}
                defaultSort={{ key: "margin", dir: "desc" }}
                columns={[
                  { key: "employeeName", label: "Empleado", render: (r) => <span className="font-medium">{r.employeeName}</span> },
                  { key: "totalRevenue", label: "Ingresos", align: "right", render: (r) => fmt.money(r.totalRevenue) },
                  { key: "totalCost", label: "Costo", align: "right", render: (r) => fmt.money(r.totalCost), hideOnMobile: true },
                  { key: "marginPerSale", label: "Por venta", align: "right", render: (r) => fmt.money(r.marginPerSale), hideOnMobile: true },
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
