"use client"

import { PackageX, Warehouse, Wallet, TrendingUp } from "lucide-react"
import { BarList, Insights, Kpi, KpiGrid, ReportEmpty, ReportPanel, ReportState, ReportTable, fmt, useBiReport } from "../report-kit"

interface Row { categoryName: string; valueAtCost: number; valueAtRetail: number; potentialMargin: number; units: number; rotation: number; productCount: number; outOfStock: number }
interface Data { rows: Row[]; totals: { valueAtCost: number; valueAtRetail: number; potentialMargin: number; units: number; productCount: number; outOfStock: number } }

export function InventoryValuationReport() {
  const state = useBiReport<Data>("inventory")

  return (
    <ReportState state={state}>
      {({ rows, totals: t }) => {
        if (rows.length === 0) return <ReportEmpty icon={Warehouse} hint="No hay existencias registradas." />
        const slow = rows.filter((r) => r.valueAtCost > 0 && r.rotation < 0.2).sort((a, b) => b.valueAtCost - a.valueAtCost)
        return (
          <>
            <KpiGrid>
              <Kpi label="Valor a costo" value={fmt.money(t.valueAtCost)} icon={Wallet} tone="primary" emphasis hint={`${fmt.num(t.units, 0)} unidades`} />
              <Kpi label="Valor a precio de venta" value={fmt.money(t.valueAtRetail)} />
              <Kpi label="Margen potencial" value={fmt.money(t.potentialMargin)} icon={TrendingUp} tone="success" hint={fmt.pct((t.potentialMargin / Math.max(t.valueAtRetail, 1)) * 100)} />
              <Kpi label="Registros sin existencia" value={fmt.int(t.outOfStock)} icon={PackageX} tone={t.outOfStock > 0 ? "danger" : "default"} hint={`de ${fmt.int(t.productCount)}`} />
            </KpiGrid>

            <ReportPanel title="Dónde está el dinero" description="Valor del inventario a costo por categoría.">
              <BarList
                items={rows.slice(0, 10).map((r) => ({
                  label: r.categoryName,
                  value: r.valueAtCost,
                  display: fmt.money(r.valueAtCost),
                  secondary: `${fmt.pct((r.valueAtCost / Math.max(t.valueAtCost, 1)) * 100)} del total · rotación ${fmt.num(r.rotation)}`,
                }))}
              />
            </ReportPanel>

            <Insights
              items={[
                slow.length > 0 && (
                  <><strong>{slow[0].categoryName}</strong> tiene {fmt.money(slow[0].valueAtCost)} en inventario y rota poco ({fmt.num(slow[0].rotation)} en el periodo): considera promoverla o comprar menos.</>
                ),
                <>La rotación es unidades vendidas en el periodo entre unidades en existencia; mientras más alta, más rápido se convierte el inventario en venta.</>,
              ]}
            />

            <ReportPanel title="Detalle por categoría" flush>
              <ReportTable
                rows={rows}
                rowKey={(r) => r.categoryName}
                defaultSort={{ key: "valueAtCost", dir: "desc" }}
                columns={[
                  { key: "categoryName", label: "Categoría", render: (r) => <span className="font-medium">{r.categoryName}</span> },
                  { key: "units", label: "Unidades", align: "right", render: (r) => fmt.num(r.units, 0), hideOnMobile: true },
                  { key: "valueAtCost", label: "A costo", align: "right", bar: true, render: (r) => <strong>{fmt.money(r.valueAtCost)}</strong> },
                  { key: "valueAtRetail", label: "A venta", align: "right", render: (r) => fmt.money(r.valueAtRetail), hideOnMobile: true },
                  { key: "rotation", label: "Rotación", align: "right", render: (r) => <span className={r.rotation < 0.2 ? "text-warning-ink" : undefined}>{fmt.num(r.rotation)}</span> },
                  { key: "outOfStock", label: "Sin existencia", align: "right", render: (r) => (r.outOfStock > 0 ? <span className="font-semibold text-destructive">{r.outOfStock}</span> : "0") },
                ]}
              />
            </ReportPanel>
          </>
        )
      }}
    </ReportState>
  )
}
