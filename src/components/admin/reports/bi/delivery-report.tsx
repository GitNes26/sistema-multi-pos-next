"use client"

import { ChefHat, CircleX, Timer, Truck } from "lucide-react"
import { StatusPill } from "@/components/base/status-pill"
import { Insights, Kpi, KpiGrid, ReportEmpty, ReportPanel, ReportState, ReportTable, fmt, useBiReport } from "../report-kit"

interface Row {
  locationName: string
  totalOrders: number
  delivered: number
  revenue: number
  avgPrepMinutes: number | null
  avgDeliveryMinutes: number | null
  avgTotalMinutes: number | null
  onTimeRate: number | null
  cancelRate: number
}

/** Promedio ponderado por pedidos (ignorando sucursales sin dato). */
function weighted(rows: Row[], key: "avgPrepMinutes" | "avgDeliveryMinutes" | "avgTotalMinutes") {
  let sum = 0
  let n = 0
  for (const r of rows) {
    const v = r[key]
    if (v != null) {
      sum += v * r.totalOrders
      n += r.totalOrders
    }
  }
  return n ? sum / n : null
}

export function DeliveryReport() {
  const state = useBiReport<{ rows: Row[] }>("delivery")

  return (
    <ReportState state={state}>
      {({ rows }) => {
        if (rows.length === 0) return <ReportEmpty icon={Truck} title="Sin pedidos a domicilio en el periodo" />
        const orders = rows.reduce((s, r) => s + r.totalOrders, 0)
        const delivered = rows.reduce((s, r) => s + r.delivered, 0)
        const cancelRate = orders ? (rows.reduce((s, r) => s + (r.cancelRate / 100) * r.totalOrders, 0) / orders) * 100 : 0
        const prep = weighted(rows, "avgPrepMinutes")
        const ride = weighted(rows, "avgDeliveryMinutes")
        const full = weighted(rows, "avgTotalMinutes")
        return (
          <>
            <KpiGrid>
              <Kpi label="Pedidos a domicilio" value={fmt.int(orders)} icon={Truck} tone="primary" emphasis hint={`${fmt.int(delivered)} entregados`} />
              <Kpi label="Tiempo total promedio" value={fmt.minutes(full)} icon={Timer} hint="de pedido a entrega" />
              <Kpi label="Preparación · Trayecto" value={`${fmt.minutes(prep)} · ${fmt.minutes(ride)}`} icon={ChefHat} />
              <Kpi label="Cancelación" value={fmt.pct(cancelRate)} icon={CircleX} tone={cancelRate > 10 ? "danger" : cancelRate > 5 ? "warning" : "success"} />
            </KpiGrid>

            <Insights
              items={[
                prep != null && ride != null && (
                  <>{prep > ride ? "La cocina / preparación" : "El trayecto"} es la etapa más larga ({fmt.minutes(Math.max(prep, ride))}): es donde más se puede recortar el tiempo de entrega.</>
                ),
                cancelRate > 10 && <>Más del 10 % de los pedidos se cancela; revisa tiempos y comunicación con el cliente.</>,
              ]}
            />

            <ReportPanel title="Por sucursal" flush>
              <ReportTable
                rows={rows}
                rowKey={(r) => r.locationName}
                defaultSort={{ key: "totalOrders", dir: "desc" }}
                columns={[
                  { key: "locationName", label: "Sucursal", render: (r) => <span className="font-medium">{r.locationName}</span> },
                  { key: "totalOrders", label: "Pedidos", align: "right", bar: true, render: (r) => <strong>{fmt.int(r.totalOrders)}</strong> },
                  { key: "avgPrepMinutes", label: "Preparación", align: "right", render: (r) => fmt.minutes(r.avgPrepMinutes), hideOnMobile: true },
                  { key: "avgDeliveryMinutes", label: "Trayecto", align: "right", render: (r) => fmt.minutes(r.avgDeliveryMinutes), hideOnMobile: true },
                  { key: "avgTotalMinutes", label: "Total", align: "right", render: (r) => fmt.minutes(r.avgTotalMinutes) },
                  { key: "revenue", label: "Venta entregada", align: "right", render: (r) => fmt.money(r.revenue), hideOnMobile: true },
                  {
                    key: "cancelRate",
                    label: "Cancelación",
                    align: "right",
                    render: (r) => <StatusPill tone={r.cancelRate > 10 ? "danger" : r.cancelRate > 5 ? "warning" : "success"}>{fmt.pct(r.cancelRate)}</StatusPill>,
                  },
                ]}
              />
            </ReportPanel>
          </>
        )
      }}
    </ReportState>
  )
}
