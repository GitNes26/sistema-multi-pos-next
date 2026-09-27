"use client"

import { Receipt, Tag, TrendingUp } from "lucide-react"
import { StatusPill } from "@/components/base/status-pill"
import { Insights, Kpi, KpiGrid, ReportEmpty, ReportPanel, ReportState, ReportTable, fmt, useBiReport } from "../report-kit"

interface Row { promotionId: string; promotionName: string; discountGiven: number; ordersCount: number; revenueGenerated: number; avgTicket: number; roi: number }

// El ROI compara el ingreso de las ventas con promoción contra lo que costó
// el descuento. No mide ventas incrementales (lo que se habría vendido igual).
const roiTone = (roi: number): "success" | "primary" | "warning" | "danger" => roi >= 500 ? "success" : roi >= 100 ? "primary" : roi >= 0 ? "warning" : "danger"

export function PromosRoiReport() {
  const state = useBiReport<{ rows: Row[] }>("promos_roi")

  return (
    <ReportState state={state}>
      {({ rows }) => {
        if (rows.length === 0) return <ReportEmpty icon={Tag} title="Ninguna promoción se usó en este periodo" hint="Cuando una venta aplique una promoción, aparecerá aquí." />
        const discount = rows.reduce((s, r) => s + r.discountGiven, 0)
        const revenue = rows.reduce((s, r) => s + r.revenueGenerated, 0)
        const uses = rows.reduce((s, r) => s + r.ordersCount, 0)
        const best = [...rows].sort((a, b) => b.roi - a.roi)[0]
        const worst = [...rows].sort((a, b) => a.roi - b.roi)[0]
        return (
          <>
            <KpiGrid>
              <Kpi label="Ventas con promoción" value={fmt.money(revenue)} icon={TrendingUp} tone="primary" emphasis />
              <Kpi label="Descuento otorgado" value={fmt.money(discount)} icon={Tag} tone="warning" hint={`${fmt.pct((discount / Math.max(revenue, 1)) * 100)} de esas ventas`} />
              <Kpi label="Usos" value={fmt.int(uses)} icon={Receipt} hint={`${rows.length} promociones`} />
              <Kpi label="Retorno global" value={fmt.pct(discount > 0 ? ((revenue - discount) / discount) * 100 : 0, 0)} tone="success" />
            </KpiGrid>

            <Insights
              items={[
                <><strong>{best.promotionName}</strong> tiene el mejor retorno: {fmt.pct(best.roi, 0)} ({fmt.money(best.revenueGenerated)} vendidos por {fmt.money(best.discountGiven)} de descuento).</>,
                rows.length > 1 && worst.promotionId !== best.promotionId && worst.roi < 100 && (
                  <><strong>{worst.promotionName}</strong> rinde poco ({fmt.pct(worst.roi, 0)}): evalúa ajustar el beneficio o las condiciones.</>
                ),
                <span key="nota" className="text-muted-foreground">El retorno compara el ingreso de las ventas con promoción contra el descuento; no distingue ventas que se habrían hecho igual.</span>,
              ]}
            />

            <ReportPanel title="Rendimiento por promoción" flush>
              <ReportTable
                rows={rows}
                rowKey={(r) => r.promotionId}
                defaultSort={{ key: "revenueGenerated", dir: "desc" }}
                columns={[
                  { key: "promotionName", label: "Promoción", render: (r) => <span className="font-medium">{r.promotionName}</span> },
                  { key: "ordersCount", label: "Usos", align: "right", render: (r) => fmt.int(r.ordersCount) },
                  { key: "discountGiven", label: "Descuento", align: "right", render: (r) => fmt.money(r.discountGiven) },
                  { key: "avgTicket", label: "Ticket promedio", align: "right", render: (r) => fmt.money(r.avgTicket), hideOnMobile: true },
                  { key: "revenueGenerated", label: "Ventas", align: "right", bar: true, render: (r) => <strong>{fmt.money(r.revenueGenerated)}</strong> },
                  { key: "roi", label: "Retorno", align: "right", render: (r) => <StatusPill tone={roiTone(r.roi)}>{fmt.pct(r.roi, 0)}</StatusPill> },
                ]}
              />
            </ReportPanel>
          </>
        )
      }}
    </ReportState>
  )
}
