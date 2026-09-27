"use client"

import Link from "next/link"
import { ArrowRight, Landmark, TriangleAlert, Users, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusPill, type StatusTone } from "@/components/base/status-pill"
import { BarList, Kpi, KpiGrid, ReportEmpty, ReportPanel, ReportState, ReportTable, fmt, useBiReport } from "../report-kit"

interface Row { customerId: string; customerName: string; balance: number; creditLimit: number | null; usagePct: number | null; oldestDebtDate: string | null; daysOverdue: number; agingBucket: string }
interface Data { rows: Row[]; buckets: { label: string; count: number; balance: number }[]; totals: { balance: number; overdue: number; overduePct: number; customers: number } }

const BUCKET_TONE: Record<string, StatusTone> = {
  "Al corriente": "success",
  "1–30 días": "warning",
  "31–60 días": "warning",
  "61–90 días": "danger",
  "Más de 90 días": "danger",
}
const barTone = (t: StatusTone) => (t === "danger" ? "danger" : t === "warning" ? "warning" : "success") as "danger" | "warning" | "success"

export function CreditAgingReport() {
  const state = useBiReport<Data>("credit_aging")

  return (
    <ReportState state={state}>
      {({ rows, buckets, totals: t }) => {
        if (rows.length === 0) return <ReportEmpty icon={Landmark} title="No hay saldos pendientes" hint="Ningún cliente tiene deuda a crédito." />
        return (
          <>
            <KpiGrid>
              <Kpi label="Cartera total" value={fmt.money(t.balance)} icon={Wallet} tone="primary" emphasis />
              <Kpi label="Vencida" value={fmt.money(t.overdue)} icon={TriangleAlert} tone={t.overdue > 0 ? "danger" : "success"} hint={fmt.pct(t.overduePct)} />
              <Kpi label="Clientes con saldo" value={fmt.int(t.customers)} icon={Users} />
              <Kpi label="Mayor antigüedad" value={`${fmt.int(rows[0].daysOverdue)} días`} hint={rows[0].customerName} tone={rows[0].daysOverdue > 60 ? "danger" : "warning"} />
            </KpiGrid>

            <ReportPanel title="Antigüedad de la cartera" description="Saldo agrupado por días de vencimiento de la deuda más antigua pendiente.">
              <BarList
                items={buckets.map((b) => ({
                  label: b.label,
                  value: b.balance,
                  display: fmt.money(b.balance),
                  secondary: `${fmt.int(b.count)} ${b.count === 1 ? "cliente" : "clientes"}`,
                  tone: barTone(BUCKET_TONE[b.label] ?? "neutral"),
                }))}
              />
            </ReportPanel>

            <ReportPanel
              title="Clientes con saldo"
              flush
              actions={
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/credits">
                    Gestionar cobranza <ArrowRight className="size-4" />
                  </Link>
                </Button>
              }
            >
              <ReportTable
                rows={rows}
                rowKey={(r) => r.customerId}
                limit={20}
                defaultSort={{ key: "daysOverdue", dir: "desc" }}
                columns={[
                  { key: "customerName", label: "Cliente", render: (r) => <span className="font-medium">{r.customerName}</span> },
                  { key: "oldestDebtDate", label: "Deuda desde", render: (r) => (r.oldestDebtDate ? fmt.day(r.oldestDebtDate) : "—"), hideOnMobile: true },
                  {
                    key: "usagePct",
                    label: "Uso del límite",
                    align: "right",
                    value: (r) => r.usagePct ?? -1,
                    render: (r) => (r.usagePct == null ? <span className="text-muted-foreground">Sin límite</span> : <span className={r.usagePct >= 90 ? "font-semibold text-destructive" : undefined}>{fmt.pct(r.usagePct, 0)}</span>),
                    hideOnMobile: true,
                  },
                  { key: "daysOverdue", label: "Antigüedad", render: (r) => <StatusPill tone={BUCKET_TONE[r.agingBucket] ?? "neutral"}>{r.agingBucket}</StatusPill> },
                  { key: "balance", label: "Saldo", align: "right", bar: true, render: (r) => <strong>{fmt.money(r.balance)}</strong> },
                ]}
              />
            </ReportPanel>
          </>
        )
      }}
    </ReportState>
  )
}
