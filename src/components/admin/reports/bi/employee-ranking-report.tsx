"use client"

import { Medal, Receipt, UserCheck, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { Insights, Kpi, KpiGrid, ReportEmpty, ReportPanel, ReportState, ReportTable, fmt, useBiReport } from "../report-kit"

interface Row { employeeName: string; totalSales: number; saleCount: number; avgTicket: number; totalUnits: number; unitsPerTicket: number; sharePct: number }

const MEDALS = ["text-warning", "text-muted-foreground", "text-warning-ink/70"]

export function EmployeeRankingReport() {
  const state = useBiReport<{ rows: Row[] }>("employee_ranking")

  return (
    <ReportState state={state}>
      {({ rows }) => {
        if (rows.length === 0) return <ReportEmpty icon={Users} hint="No hay ventas completadas en el periodo." />
        const total = rows.reduce((s, r) => s + r.totalSales, 0)
        const tickets = rows.reduce((s, r) => s + r.saleCount, 0)
        const avgTicket = tickets ? total / tickets : 0
        const bestTicket = [...rows].sort((a, b) => b.avgTicket - a.avgTicket)[0]
        return (
          <>
            <KpiGrid>
              <Kpi label="Personas vendiendo" value={fmt.int(rows.length)} icon={Users} />
              <Kpi label="Líder en ventas" value={<span className="text-base sm:text-lg">{rows[0].employeeName}</span>} icon={Medal} tone="primary" emphasis hint={fmt.money(rows[0].totalSales)} />
              <Kpi label="Ticket promedio del equipo" value={fmt.money(avgTicket)} icon={Receipt} />
              <Kpi label="Mejor ticket promedio" value={fmt.money(bestTicket.avgTicket)} icon={UserCheck} tone="success" hint={bestTicket.employeeName} />
            </KpiGrid>

            <div className="grid gap-3 sm:grid-cols-3">
              {rows.slice(0, 3).map((r, i) => (
                <div key={r.employeeName} className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-e1">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Medal className={cn("size-5", MEDALS[i])} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{r.employeeName}</p>
                    <p className="text-sm tabular-nums text-muted-foreground">
                      {fmt.money(r.totalSales)} · {fmt.pct(r.sharePct, 0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Insights
              items={[
                bestTicket.avgTicket > avgTicket * 1.15 && bestTicket.employeeName !== rows[0].employeeName && (
                  <><strong>{bestTicket.employeeName}</strong> logra el ticket más alto ({fmt.money(bestTicket.avgTicket)}), {fmt.pct(((bestTicket.avgTicket - avgTicket) / avgTicket) * 100, 0)} sobre el promedio: su forma de vender puede servir de ejemplo.</>
                ),
                rows.length > 1 && rows[0].sharePct > 50 && <><strong>{rows[0].employeeName}</strong> concentra más de la mitad de las ventas.</>,
              ]}
            />

            <ReportPanel title="Desempeño" flush>
              <ReportTable
                rows={rows}
                rowKey={(r) => r.employeeName}
                defaultSort={{ key: "totalSales", dir: "desc" }}
                columns={[
                  { key: "employeeName", label: "Empleado", render: (r) => <span className="font-medium">{r.employeeName}</span> },
                  { key: "saleCount", label: "Tickets", align: "right", render: (r) => fmt.int(r.saleCount) },
                  { key: "avgTicket", label: "Ticket prom.", align: "right", render: (r) => fmt.money(r.avgTicket) },
                  { key: "unitsPerTicket", label: "Art./ticket", align: "right", render: (r) => fmt.num(r.unitsPerTicket, 1), hideOnMobile: true },
                  { key: "sharePct", label: "Part.", align: "right", render: (r) => fmt.pct(r.sharePct), hideOnMobile: true },
                  { key: "totalSales", label: "Ventas", align: "right", bar: true, render: (r) => <strong>{fmt.money(r.totalSales)}</strong> },
                ]}
              />
            </ReportPanel>
          </>
        )
      }}
    </ReportState>
  )
}
