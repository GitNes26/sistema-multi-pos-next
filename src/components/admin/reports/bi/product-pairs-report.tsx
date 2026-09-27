"use client"

import { Layers, Plus, ShoppingBasket } from "lucide-react"
import { Insights, Kpi, KpiGrid, ReportEmpty, ReportPanel, ReportState, ReportTable, fmt, useBiReport } from "../report-kit"

interface Row { productA: string; productB: string; timesTogether: number; supportPct: number; avgRevenue: number }
interface Data { rows: Row[]; tickets: number; multiItemPct: number }

export function ProductPairsReport() {
  const state = useBiReport<Data>("product_pairs")

  return (
    <ReportState state={state}>
      {({ rows, tickets, multiItemPct }) => (
        <>
          <KpiGrid cols={3}>
            <Kpi label="Tickets analizados" value={fmt.int(tickets)} icon={ShoppingBasket} />
            <Kpi label="Tickets con 2+ productos" value={fmt.pct(multiItemPct)} icon={Layers} tone="primary" emphasis />
            <Kpi label="Pareja más frecuente" value={rows[0] ? `${fmt.int(rows[0].timesTogether)} veces` : "—"} hint={rows[0] ? `${rows[0].productA} + ${rows[0].productB}` : undefined} tone="success" />
          </KpiGrid>

          {rows.length === 0 ? (
            <ReportPanel title="Productos que se compran juntos">
              <ReportEmpty icon={Layers} title="Aún no hay combinaciones" hint="Se necesitan tickets con dos o más productos distintos." />
            </ReportPanel>
          ) : (
            <>
              <Insights
                items={[
                  <>
                    <strong>{rows[0].productA}</strong> y <strong>{rows[0].productB}</strong> aparecen juntos en el {fmt.pct(rows[0].supportPct)} de los tickets:
                    candidatos a un combo o a colocarse uno junto al otro.
                  </>,
                  multiItemPct < 30 && <>Solo el {fmt.pct(multiItemPct, 0)} de los tickets lleva más de un producto: sugerir complementos en caja puede subir el ticket promedio.</>,
                ]}
              />
              <ReportPanel title="Productos que se compran juntos" description="Las 20 combinaciones más frecuentes." flush>
                <ReportTable
                  rows={rows}
                  rowKey={(r) => `${r.productA}|${r.productB}`}
                  defaultSort={{ key: "timesTogether", dir: "desc" }}
                  columns={[
                    {
                      key: "pair",
                      label: "Combinación",
                      value: (r) => `${r.productA} ${r.productB}`,
                      render: (r) => (
                        <span className="flex max-w-[22rem] items-center gap-1.5">
                          <span className="truncate font-medium">{r.productA}</span>
                          <Plus className="size-3 shrink-0 text-muted-foreground" />
                          <span className="truncate font-medium">{r.productB}</span>
                        </span>
                      ),
                    },
                    { key: "timesTogether", label: "Veces", align: "right", bar: true, render: (r) => <strong>{fmt.int(r.timesTogether)}</strong> },
                    { key: "supportPct", label: "% de tickets", align: "right", render: (r) => fmt.pct(r.supportPct, 2) },
                    { key: "avgRevenue", label: "Ticket promedio", align: "right", render: (r) => fmt.money(r.avgRevenue), hideOnMobile: true },
                  ]}
                />
              </ReportPanel>
            </>
          )}
        </>
      )}
    </ReportState>
  )
}
