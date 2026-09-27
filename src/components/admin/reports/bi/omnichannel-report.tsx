"use client"

import { Globe, Store, TrendingUp } from "lucide-react"
import { Insights, Kpi, KpiGrid, ReportPanel, ReportState, ReportTable, ShareBar, fmt, useBiReport } from "../report-kit"

interface Row {
  locationName: string
  posSales: number
  portalSales: number
  total: number
  pctWeb: number
  aovPos: number
  aovPortal: number
  posCount: number
  portalCount: number
}
interface Data {
  rows: Row[]
  totals: { posSales: number; portalSales: number; total: number; pctWeb: number; posCount: number; portalCount: number; aovPos: number; aovPortal: number }
}

export function OmnichannelReport() {
  const state = useBiReport<Data>("omnichannel")

  return (
    <ReportState state={state}>
      {({ rows, totals: t }) => {
        const maxTotal = Math.max(...rows.map((r) => r.total), 1)
        const aovGap = t.aovPos > 0 && t.aovPortal > 0 ? ((t.aovPortal - t.aovPos) / t.aovPos) * 100 : null
        return (
          <>
            <KpiGrid>
              <Kpi label="Venta total" value={fmt.money(t.total)} icon={TrendingUp} tone="primary" emphasis hint={`${fmt.int(t.posCount + t.portalCount)} tickets`} />
              <Kpi label="Punto de venta" value={fmt.money(t.posSales)} icon={Store} hint={`Ticket ${fmt.money(t.aovPos)}`} />
              <Kpi label="Portal en línea" value={fmt.money(t.portalSales)} icon={Globe} tone="info" hint={`Ticket ${fmt.money(t.aovPortal)}`} />
              <Kpi label="Participación en línea" value={fmt.pct(t.pctWeb)} tone="info" hint={`${fmt.int(t.portalCount)} pedidos`} />
            </KpiGrid>

            <ReportPanel title="Mezcla de canales" description="Proporción de la venta que entra por caja y por el portal.">
              <ShareBar
                segments={[
                  { label: "Punto de venta", value: t.posSales, display: fmt.money(t.posSales) },
                  { label: "Portal", value: t.portalSales, display: fmt.money(t.portalSales) },
                ]}
              />
            </ReportPanel>

            <Insights
              items={[
                aovGap != null && Math.abs(aovGap) >= 5 && (
                  <>El ticket del portal es <strong>{fmt.pct(Math.abs(aovGap), 0)} {aovGap > 0 ? "mayor" : "menor"}</strong> que el de caja.</>
                ),
                rows.length > 1 && (
                  <><strong>{rows[0].locationName}</strong> concentra {fmt.pct((rows[0].total / Math.max(t.total, 1)) * 100, 0)} de la venta.</>
                ),
                t.total > 0 && t.pctWeb < 5 && <>El portal aporta menos del 5 %: promoverlo en ticket y redes puede abrir un canal adicional.</>,
              ]}
            />

            <ReportPanel title="Por sucursal" flush>
              <ReportTable
                rows={rows}
                rowKey={(r) => r.locationName}
                defaultSort={{ key: "total", dir: "desc" }}
                columns={[
                  { key: "locationName", label: "Sucursal", render: (r) => <span className="font-medium">{r.locationName}</span> },
                  {
                    key: "mix",
                    label: "Mezcla",
                    value: (r) => r.pctWeb,
                    render: (r) => (
                      <span className="flex h-2 w-28 overflow-hidden rounded-full bg-muted" title={`${fmt.pct(r.pctWeb)} en línea`}>
                        <span className="bg-primary" style={{ width: `${(r.posSales / maxTotal) * 100}%` }} />
                        <span className="bg-info" style={{ width: `${(r.portalSales / maxTotal) * 100}%` }} />
                      </span>
                    ),
                    hideOnMobile: true,
                  },
                  { key: "posSales", label: "Caja", align: "right", render: (r) => fmt.money(r.posSales) },
                  { key: "portalSales", label: "Portal", align: "right", render: (r) => fmt.money(r.portalSales) },
                  { key: "pctWeb", label: "% en línea", align: "right", render: (r) => fmt.pct(r.pctWeb), hideOnMobile: true },
                  { key: "total", label: "Total", align: "right", render: (r) => <strong>{fmt.money(r.total)}</strong> },
                ]}
              />
            </ReportPanel>
          </>
        )
      }}
    </ReportState>
  )
}
