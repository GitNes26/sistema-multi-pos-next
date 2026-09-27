"use client"

import { Boxes, CalendarCheck2, CalendarX2, Clock, Store, UserX, Wallet } from "lucide-react"
import { StatusPill } from "@/components/base/status-pill"
import { Kpi, KpiGrid, ReportEmpty, ReportPanel, ReportState, ReportTable, fmt, useBiReport } from "../report-kit"

type Kind = "table_performance" | "appointments" | "rentals"

interface TableRow { tableName: string; sessions: number; avgMinutes: number; revenue: number; avgTicket: number }
interface AppointmentRow { employeeName: string; total: number; completed: number; cancelled: number; noShow: number; attendancePct: number; revenue: number }
interface RentalRow { locationName: string; reservations: number; completed: number; cancelled: number; units: number; revenue: number }

const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0)
const attendanceTone = (p: number): "success" | "primary" | "warning" | "danger" => p >= 85 ? "success" : p >= 65 ? "warning" : "danger"

// Reportes operativos según el tipo de negocio: mesas (restaurante), citas
// (servicios) y rentas. Comparten estructura: KPIs y tabla por responsable.
export function OperationalReport({ kind }: { kind: Kind }) {
  if (kind === "table_performance") return <TablesReport />
  if (kind === "appointments") return <AppointmentsReport />
  return <RentalsReport />
}

function TablesReport() {
  const state = useBiReport<{ rows: TableRow[] }>("table_performance")
  return (
    <ReportState state={state}>
      {({ rows }) => {
        if (rows.length === 0) return <ReportEmpty icon={Store} title="Sin sesiones de mesa en el periodo" />
        const sessions = sum(rows, (r) => r.sessions)
        const revenue = sum(rows, (r) => r.revenue)
        const minutes = sessions ? sum(rows, (r) => r.avgMinutes * r.sessions) / sessions : 0
        return (
          <>
            <KpiGrid>
              <Kpi label="Sesiones" value={fmt.int(sessions)} icon={Store} tone="primary" emphasis />
              <Kpi label="Venta en mesas" value={fmt.money(revenue)} icon={Wallet} />
              <Kpi label="Estancia promedio" value={fmt.minutes(minutes)} icon={Clock} />
              <Kpi label="Ticket por mesa" value={fmt.money(sessions ? revenue / sessions : 0)} tone="success" />
            </KpiGrid>
            <ReportPanel title="Rendimiento por mesa" flush>
              <ReportTable
                rows={rows}
                rowKey={(r) => r.tableName}
                defaultSort={{ key: "revenue", dir: "desc" }}
                columns={[
                  { key: "tableName", label: "Mesa", render: (r) => <span className="font-medium">{r.tableName}</span> },
                  { key: "sessions", label: "Sesiones", align: "right", render: (r) => fmt.int(r.sessions) },
                  { key: "avgMinutes", label: "Estancia", align: "right", render: (r) => fmt.minutes(r.avgMinutes) },
                  { key: "avgTicket", label: "Ticket", align: "right", render: (r) => fmt.money(r.avgTicket), hideOnMobile: true },
                  { key: "revenue", label: "Ingresos", align: "right", bar: true, render: (r) => <strong>{fmt.money(r.revenue)}</strong> },
                ]}
              />
            </ReportPanel>
          </>
        )
      }}
    </ReportState>
  )
}

function AppointmentsReport() {
  const state = useBiReport<{ rows: AppointmentRow[] }>("appointments")
  return (
    <ReportState state={state}>
      {({ rows }) => {
        if (rows.length === 0) return <ReportEmpty icon={CalendarCheck2} title="Sin citas en el periodo" />
        const total = sum(rows, (r) => r.total)
        const completed = sum(rows, (r) => r.completed)
        const noShow = sum(rows, (r) => r.noShow)
        const cancelled = sum(rows, (r) => r.cancelled)
        return (
          <>
            <KpiGrid>
              <Kpi label="Citas" value={fmt.int(total)} icon={CalendarCheck2} tone="primary" emphasis hint={`${fmt.int(completed)} atendidas`} />
              <Kpi label="Asistencia" value={fmt.pct(total ? (completed / total) * 100 : 0)} tone={attendanceTone(total ? (completed / total) * 100 : 0)} />
              <Kpi label="No asistió" value={fmt.int(noShow)} icon={UserX} tone={noShow > 0 ? "warning" : "default"} hint={`${fmt.int(cancelled)} canceladas`} />
              <Kpi label="Ingresos por citas" value={fmt.money(sum(rows, (r) => r.revenue))} icon={Wallet} tone="success" />
            </KpiGrid>
            <ReportPanel title="Por profesional" flush>
              <ReportTable
                rows={rows}
                rowKey={(r) => r.employeeName}
                defaultSort={{ key: "revenue", dir: "desc" }}
                columns={[
                  { key: "employeeName", label: "Profesional", render: (r) => <span className="font-medium">{r.employeeName}</span> },
                  { key: "total", label: "Citas", align: "right", render: (r) => fmt.int(r.total) },
                  { key: "completed", label: "Atendidas", align: "right", render: (r) => fmt.int(r.completed), hideOnMobile: true },
                  { key: "noShow", label: "No asistió", align: "right", render: (r) => fmt.int(r.noShow), hideOnMobile: true },
                  { key: "attendancePct", label: "Asistencia", align: "right", render: (r) => <StatusPill tone={attendanceTone(r.attendancePct)}>{fmt.pct(r.attendancePct, 0)}</StatusPill> },
                  { key: "revenue", label: "Ingresos", align: "right", bar: true, render: (r) => <strong>{fmt.money(r.revenue)}</strong> },
                ]}
              />
            </ReportPanel>
          </>
        )
      }}
    </ReportState>
  )
}

function RentalsReport() {
  const state = useBiReport<{ rows: RentalRow[] }>("rentals")
  return (
    <ReportState state={state}>
      {({ rows }) => {
        if (rows.length === 0) return <ReportEmpty icon={Boxes} title="Sin reservaciones en el periodo" />
        const total = sum(rows, (r) => r.reservations)
        const cancelled = sum(rows, (r) => r.cancelled)
        const revenue = sum(rows, (r) => r.revenue)
        return (
          <>
            <KpiGrid>
              <Kpi label="Reservaciones" value={fmt.int(total)} icon={Boxes} tone="primary" emphasis hint={`${fmt.int(sum(rows, (r) => r.completed))} completadas`} />
              <Kpi label="Unidades rentadas" value={fmt.num(sum(rows, (r) => r.units), 0)} />
              <Kpi label="Canceladas" value={fmt.int(cancelled)} icon={CalendarX2} tone={cancelled > 0 ? "warning" : "default"} hint={total ? fmt.pct((cancelled / total) * 100, 0) : undefined} />
              <Kpi label="Ingresos por renta" value={fmt.money(revenue)} icon={Wallet} tone="success" hint={`Promedio ${fmt.money(total ? revenue / total : 0)}`} />
            </KpiGrid>
            <ReportPanel title="Por sucursal" flush>
              <ReportTable
                rows={rows}
                rowKey={(r) => r.locationName}
                defaultSort={{ key: "revenue", dir: "desc" }}
                columns={[
                  { key: "locationName", label: "Sucursal", render: (r) => <span className="font-medium">{r.locationName}</span> },
                  { key: "reservations", label: "Reservaciones", align: "right", render: (r) => fmt.int(r.reservations) },
                  { key: "completed", label: "Completadas", align: "right", render: (r) => fmt.int(r.completed), hideOnMobile: true },
                  { key: "cancelled", label: "Canceladas", align: "right", render: (r) => fmt.int(r.cancelled), hideOnMobile: true },
                  { key: "units", label: "Unidades", align: "right", render: (r) => fmt.num(r.units, 0) },
                  { key: "revenue", label: "Ingresos", align: "right", bar: true, render: (r) => <strong>{fmt.money(r.revenue)}</strong> },
                ]}
              />
            </ReportPanel>
          </>
        )
      }}
    </ReportState>
  )
}
