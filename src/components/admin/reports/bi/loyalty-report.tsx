"use client"

import { Gift, Repeat, Star, Users } from "lucide-react"
import { EntityCell } from "@/components/base/entity-cell"
import { Insights, Kpi, KpiGrid, ReportEmpty, ReportPanel, ReportState, ReportTable, fmt, useBiReport } from "../report-kit"

interface Row { customerId: string; customerName: string; totalPoints: number; pointsBalance: number; totalSpent: number; orderCount: number; avgTicket: number; lastOrderDate: string | null }
interface Data { rows: Row[]; totals: { activeCustomers: number; pointsIssued: number; pointsBalance: number; repeatCustomers: number } }

export function LoyaltyReport() {
  const state = useBiReport<Data>("loyalty")

  return (
    <ReportState state={state}>
      {({ rows, totals: t }) => {
        if (rows.length === 0) return <ReportEmpty icon={Star} title="Sin actividad de clientes en el periodo" hint="Asigna el cliente en caja para acumular puntos y medir su lealtad." />
        const spent = rows.reduce((s, r) => s + r.totalSpent, 0)
        const top10 = rows.slice(0, Math.max(1, Math.ceil(rows.length * 0.1))).reduce((s, r) => s + r.totalSpent, 0)
        return (
          <>
            <KpiGrid>
              <Kpi label="Clientes activos" value={fmt.int(t.activeCustomers)} icon={Users} tone="primary" emphasis />
              <Kpi label="Compran más de una vez" value={fmt.pct((t.repeatCustomers / Math.max(t.activeCustomers, 1)) * 100, 0)} icon={Repeat} tone="success" hint={`${fmt.int(t.repeatCustomers)} clientes`} />
              <Kpi label="Puntos otorgados" value={fmt.int(t.pointsIssued)} icon={Star} tone="warning" />
              <Kpi label="Saldo de puntos" value={fmt.int(t.pointsBalance)} icon={Gift} hint="pendiente de canjear" />
            </KpiGrid>

            <Insights
              items={[
                spent > 0 && <>El 10 % de los mejores clientes genera el <strong>{fmt.pct((top10 / spent) * 100, 0)}</strong> de lo que gastan los clientes identificados.</>,
                t.pointsBalance > 0 && <>Hay <strong>{fmt.int(t.pointsBalance)}</strong> puntos sin canjear: recordarlos puede traer a esos clientes de vuelta.</>,
              ]}
            />

            <ReportPanel title="Mejores clientes" description="Ordenados por gasto en el periodo." flush>
              <ReportTable
                rows={rows}
                rowKey={(r) => r.customerId}
                limit={20}
                defaultSort={{ key: "totalSpent", dir: "desc" }}
                columns={[
                  {
                    key: "customerName",
                    label: "Cliente",
                    render: (r) => (
                      <EntityCell title={r.customerName} subtitle={r.lastOrderDate ? `Última compra ${fmt.day(r.lastOrderDate)}` : undefined} />
                    ),
                  },
                  { key: "orderCount", label: "Compras", align: "right", render: (r) => fmt.int(r.orderCount) },
                  { key: "avgTicket", label: "Ticket prom.", align: "right", render: (r) => fmt.money(r.avgTicket), hideOnMobile: true },
                  { key: "totalPoints", label: "Puntos ganados", align: "right", render: (r) => fmt.int(r.totalPoints), hideOnMobile: true },
                  { key: "pointsBalance", label: "Saldo", align: "right", render: (r) => fmt.int(r.pointsBalance), hideOnMobile: true },
                  { key: "totalSpent", label: "Gasto", align: "right", bar: true, render: (r) => <strong>{fmt.money(r.totalSpent)}</strong> },
                ]}
              />
            </ReportPanel>
          </>
        )
      }}
    </ReportState>
  )
}
