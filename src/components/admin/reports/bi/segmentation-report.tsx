"use client"

import { Crown, PieChart, Users } from "lucide-react"
import { StatusPill, type StatusTone } from "@/components/base/status-pill"
import { Insights, Kpi, KpiGrid, ReportEmpty, ReportPanel, ReportState, ReportTable, ShareBar, fmt, useBiReport } from "../report-kit"

interface Row { segment: string; segmentType: string; customerCount: number; sharePct: number; avgSpent: number; avgOrders: number }

const TONES: Record<string, StatusTone> = { vip: "primary", regular: "success", new: "info", at_risk: "warning", dormant: "danger", coupon_hunter: "neutral" }

export function SegmentationReport() {
  const state = useBiReport<{ rows: Row[] }>("segmentation")

  return (
    <ReportState state={state} kpis={3}>
      {({ rows }) => {
        if (rows.length === 0) return <ReportEmpty icon={PieChart} title="Aún no hay segmentos calculados" hint="Los segmentos se asignan automáticamente con el historial de compras de cada cliente." />
        const total = rows.reduce((s, r) => s + r.customerCount, 0)
        const vip = rows.find((r) => r.segment === "vip")
        const risk = rows.filter((r) => r.segment === "at_risk" || r.segment === "dormant").reduce((s, r) => s + r.customerCount, 0)
        return (
          <>
            <KpiGrid cols={3}>
              <Kpi label="Clientes segmentados" value={fmt.int(total)} icon={Users} tone="primary" emphasis />
              <Kpi label="VIP" value={fmt.int(vip?.customerCount ?? 0)} icon={Crown} tone="success" hint={vip ? `Gasto prom. ${fmt.money(vip.avgSpent)}` : undefined} />
              <Kpi label="En riesgo o inactivos" value={fmt.int(risk)} tone={risk > 0 ? "warning" : "default"} hint={total ? fmt.pct((risk / total) * 100, 0) : undefined} />
            </KpiGrid>

            <ReportPanel title="Composición de la clientela">
              <ShareBar segments={rows.map((r) => ({ label: r.segmentType, value: r.customerCount, display: fmt.int(r.customerCount) }))} />
            </ReportPanel>

            <Insights
              items={[
                risk > 0 && <><strong>{fmt.int(risk)}</strong> clientes están en riesgo o inactivos: una campaña de reactivación desde Publicaciones puede recuperarlos.</>,
                vip && <>Un cliente VIP gasta en promedio <strong>{fmt.money(vip.avgSpent)}</strong> con {fmt.num(vip.avgOrders, 1)} compras.</>,
              ]}
            />

            <ReportPanel title="Detalle por segmento" flush>
              <ReportTable
                rows={rows}
                rowKey={(r) => r.segment}
                defaultSort={{ key: "customerCount", dir: "desc" }}
                columns={[
                  { key: "segmentType", label: "Segmento", render: (r) => <StatusPill tone={TONES[r.segment] ?? "neutral"}>{r.segmentType}</StatusPill> },
                  { key: "customerCount", label: "Clientes", align: "right", bar: true, render: (r) => <strong>{fmt.int(r.customerCount)}</strong> },
                  { key: "sharePct", label: "Part.", align: "right", render: (r) => fmt.pct(r.sharePct) },
                  { key: "avgOrders", label: "Compras prom.", align: "right", render: (r) => fmt.num(r.avgOrders, 1), hideOnMobile: true },
                  { key: "avgSpent", label: "Gasto prom.", align: "right", render: (r) => fmt.money(r.avgSpent) },
                ]}
              />
            </ReportPanel>
          </>
        )
      }}
    </ReportState>
  )
}
