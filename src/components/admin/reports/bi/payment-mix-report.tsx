"use client"

import { Banknote, CreditCard, Gift, Landmark, Wallet, type LucideIcon } from "lucide-react"
import { Insights, Kpi, KpiGrid, ReportEmpty, ReportPanel, ReportState, ReportTable, ShareBar, fmt, useBiReport } from "../report-kit"

interface Row { method: string; methodKey: string; count: number; total: number; avgAmount: number; pct: number }

const ICONS: Record<string, LucideIcon> = { cash: Banknote, card: CreditCard, wallet: Wallet, points: Gift, credit: Landmark }

export function PaymentMixReport() {
  const state = useBiReport<{ rows: Row[] }>("payment_mix")

  return (
    <ReportState state={state}>
      {({ rows }) => {
        if (rows.length === 0) return <ReportEmpty icon={CreditCard} hint="No hay pagos registrados en el periodo." />
        const total = rows.reduce((s, r) => s + r.total, 0)
        const count = rows.reduce((s, r) => s + r.count, 0)
        const cash = rows.find((r) => r.methodKey === "cash")
        const digital = rows.filter((r) => r.methodKey === "card" || r.methodKey === "wallet").reduce((s, r) => s + r.total, 0)
        return (
          <>
            <KpiGrid>
              <Kpi label="Cobrado" value={fmt.money(total)} icon={Wallet} tone="primary" emphasis hint={`${fmt.int(count)} pagos`} />
              <Kpi label="Método principal" value={rows[0].method} hint={fmt.pct(rows[0].pct)} />
              <Kpi label="Efectivo" value={fmt.pct(cash?.pct ?? 0)} icon={Banknote} tone="success" hint={fmt.money(cash?.total ?? 0)} />
              <Kpi label="Tarjeta y digital" value={fmt.pct((digital / Math.max(total, 1)) * 100)} icon={CreditCard} tone="info" hint={fmt.money(digital)} />
            </KpiGrid>

            <ReportPanel title="Participación por método">
              <ShareBar segments={rows.map((r) => ({ label: r.method, value: r.total }))} />
            </ReportPanel>

            <Insights
              items={[
                cash && cash.pct >= 60 && <>El <strong>{fmt.pct(cash.pct, 0)}</strong> se cobra en efectivo: revisa los cortes de caja con frecuencia y considera incentivar pagos con tarjeta.</>,
                rows.some((r) => r.methodKey === "credit") && <>Parte de la venta se cobró a crédito; consulta <strong>Cartera de crédito</strong> para dar seguimiento a los saldos.</>,
              ]}
            />

            <ReportPanel title="Detalle" flush>
              <ReportTable
                rows={rows}
                rowKey={(r) => r.methodKey}
                defaultSort={{ key: "total", dir: "desc" }}
                columns={[
                  {
                    key: "method",
                    label: "Método",
                    render: (r) => {
                      const Icon = ICONS[r.methodKey] ?? Wallet
                      return (
                        <span className="flex items-center gap-2 font-medium">
                          <Icon className="size-4 text-muted-foreground" /> {r.method}
                        </span>
                      )
                    },
                  },
                  { key: "count", label: "Pagos", align: "right", render: (r) => fmt.int(r.count) },
                  { key: "avgAmount", label: "Pago promedio", align: "right", render: (r) => fmt.money(r.avgAmount), hideOnMobile: true },
                  { key: "pct", label: "Participación", align: "right", render: (r) => fmt.pct(r.pct) },
                  { key: "total", label: "Importe", align: "right", bar: true, render: (r) => <strong>{fmt.money(r.total)}</strong> },
                ]}
              />
            </ReportPanel>
          </>
        )
      }}
    </ReportState>
  )
}
