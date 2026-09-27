"use client"

import { ArrowRight, ArrowRightLeft, PackageCheck, Truck } from "lucide-react"
import { StatusPill, type StatusTone } from "@/components/base/status-pill"
import { Kpi, KpiGrid, ReportEmpty, ReportPanel, ReportState, ReportTable, fmt, useBiReport } from "../report-kit"

interface Row { id: string; fromLocation: string; toLocation: string; status: string; itemCount: number; totalQty: number; createdAt: string }
interface Data { rows: Row[]; totals: { total: number; received: number; inTransit: number; pending: number; cancelled: number; units: number } }

const STATUS: Record<string, { label: string; tone: StatusTone }> = {
  pending: { label: "Pendiente", tone: "warning" },
  in_transit: { label: "En tránsito", tone: "info" },
  received: { label: "Recibida", tone: "success" },
  cancelled: { label: "Cancelada", tone: "neutral" },
}

export function TransfersReport() {
  const state = useBiReport<Data>("transfers")

  return (
    <ReportState state={state}>
      {({ rows, totals: t }) => (
        <>
          <KpiGrid>
            <Kpi label="Transferencias" value={fmt.int(t.total)} icon={ArrowRightLeft} tone="primary" emphasis hint={`${fmt.num(t.units, 0)} unidades`} />
            <Kpi label="Recibidas" value={fmt.int(t.received)} icon={PackageCheck} tone="success" hint={t.total ? fmt.pct((t.received / t.total) * 100, 0) : undefined} />
            <Kpi label="En tránsito" value={fmt.int(t.inTransit)} icon={Truck} tone="info" />
            <Kpi label="Pendientes" value={fmt.int(t.pending)} tone={t.pending > 0 ? "warning" : "default"} />
          </KpiGrid>

          <ReportPanel title="Movimientos entre ubicaciones" flush>
            {rows.length === 0 ? (
              <ReportEmpty icon={ArrowRightLeft} title="Sin transferencias en el periodo" />
            ) : (
              <ReportTable
                rows={rows}
                rowKey={(r) => r.id}
                limit={20}
                columns={[
                  { key: "createdAt", label: "Fecha", render: (r) => fmt.day(r.createdAt) },
                  {
                    key: "route",
                    label: "Ruta",
                    value: (r) => `${r.fromLocation} ${r.toLocation}`,
                    render: (r) => (
                      <span className="flex items-center gap-1.5 font-medium">
                        {r.fromLocation} <ArrowRight className="size-3.5 text-muted-foreground" /> {r.toLocation}
                      </span>
                    ),
                  },
                  { key: "itemCount", label: "Partidas", align: "right", render: (r) => fmt.int(r.itemCount), hideOnMobile: true },
                  { key: "totalQty", label: "Unidades", align: "right", bar: true, render: (r) => <strong>{fmt.num(r.totalQty)}</strong> },
                  {
                    key: "status",
                    label: "Estado",
                    render: (r) => {
                      const s = STATUS[r.status] ?? { label: r.status, tone: "neutral" as const }
                      return <StatusPill tone={s.tone}>{s.label}</StatusPill>
                    },
                  },
                ]}
              />
            )}
          </ReportPanel>
        </>
      )}
    </ReportState>
  )
}
