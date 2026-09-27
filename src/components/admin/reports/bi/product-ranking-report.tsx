"use client"

import { useState } from "react"
import { Package, Trophy } from "lucide-react"
import { SegmentedFilter } from "@/components/base/segmented-filter"
import { Insights, Kpi, KpiGrid, ReportEmpty, ReportPanel, ReportState, ReportTable, fmt, useBiReport } from "../report-kit"

interface Row { productName: string; categoryName: string; quantity: number; revenue: number; margin: number; marginPct: number; sharePct: number }
interface Data { rows: Row[]; total: number; totalRevenue: number }
type Sort = "revenue" | "quantity" | "margin"

const SORTS: { value: Sort; label: string }[] = [
  { value: "revenue", label: "Ingreso" },
  { value: "quantity", label: "Unidades" },
  { value: "margin", label: "Margen" },
]

export function ProductRankingReport() {
  const [sort, setSort] = useState<Sort>("revenue")
  const state = useBiReport<Data>("ranking", { sort })

  return (
    <ReportState state={state}>
      {({ rows, total, totalRevenue }) => {
        if (rows.length === 0) return <ReportEmpty icon={Package} hint="No se vendieron productos en el periodo." />
        // Regla 80/20: cuántos productos explican el 80 % del ingreso.
        const byRevenue = [...rows].sort((a, b) => b.revenue - a.revenue)
        let acc = 0
        let pareto = 0
        for (const r of byRevenue) {
          acc += r.revenue
          pareto += 1
          if (acc >= totalRevenue * 0.8) break
        }
        const lowMargin = rows.filter((r) => r.marginPct < 15 && r.revenue > 0).length
        return (
          <>
            <KpiGrid>
              <Kpi label="Productos vendidos" value={fmt.int(total)} icon={Package} />
              <Kpi label="Ingreso total" value={fmt.money(totalRevenue)} tone="primary" emphasis />
              <Kpi label="Más vendido" value={<span className="text-base sm:text-lg">{byRevenue[0].productName}</span>} icon={Trophy} tone="success" hint={fmt.money(byRevenue[0].revenue)} />
              <Kpi label="Concentración 80 %" value={`${pareto} productos`} hint={`de ${fmt.int(total)}`} />
            </KpiGrid>

            <Insights
              items={[
                <><strong>{pareto}</strong> productos generan el 80 % del ingreso: cuida que nunca les falte existencia.</>,
                lowMargin > 0 && <><strong>{lowMargin}</strong> de los 50 principales dejan menos de 15 % de margen.</>,
              ]}
            />

            <ReportPanel
              title="Ranking"
              description={`Los ${rows.length} principales del periodo`}
              actions={<SegmentedFilter options={SORTS} value={sort} onChange={setSort} ariaLabel="Ordenar por" />}
              flush
            >
              <ReportTable
                rows={rows}
                rowKey={(r, i) => `${r.productName}-${i}`}
                limit={20}
                columns={[
                  {
                    key: "rank",
                    label: "#",
                    value: (r) => rows.indexOf(r),
                    render: (r) => {
                      const i = rows.indexOf(r)
                      return <span className={i < 3 ? "font-bold text-primary" : "text-muted-foreground"}>{i + 1}</span>
                    },
                  },
                  {
                    key: "productName",
                    label: "Producto",
                    render: (r) => (
                      <span className="block max-w-[16rem] truncate">
                        <span className="font-medium">{r.productName}</span>
                        <span className="block text-xs text-muted-foreground">{r.categoryName}</span>
                      </span>
                    ),
                  },
                  { key: "quantity", label: "Unidades", align: "right", bar: sort === "quantity", render: (r) => fmt.num(r.quantity) },
                  { key: "revenue", label: "Ingreso", align: "right", bar: sort === "revenue", render: (r) => <strong>{fmt.money(r.revenue)}</strong> },
                  { key: "sharePct", label: "Part.", align: "right", render: (r) => fmt.pct(r.sharePct), hideOnMobile: true },
                  { key: "margin", label: "Margen", align: "right", bar: sort === "margin", render: (r) => fmt.money(r.margin), hideOnMobile: true },
                  {
                    key: "marginPct",
                    label: "Margen %",
                    align: "right",
                    render: (r) => <span className={r.marginPct < 15 ? "font-semibold text-warning-ink" : undefined}>{fmt.pct(r.marginPct)}</span>,
                  },
                ]}
              />
            </ReportPanel>
          </>
        )
      }}
    </ReportState>
  )
}
