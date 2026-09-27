"use client"

import { useState } from "react"
import { Repeat, UserPlus, Users } from "lucide-react"
import { SegmentedFilter } from "@/components/base/segmented-filter"
import { cn } from "@/lib/utils"
import { Insights, Kpi, KpiGrid, ReportEmpty, ReportPanel, ReportState, fmt, useBiReport } from "../report-kit"

interface CohortRow { cohort: string; initialCount: number; retention: (number | null)[] }
interface Data { cohorts: CohortRow[]; months: string[]; newCustomers: number }

const WINDOWS = [
  { value: "6", label: "6 meses" },
  { value: "12", label: "12 meses" },
]

// Intensidad por porcentaje de retención sobre el color de la empresa.
const cellClass = (pct: number | null, first: boolean) => {
  if (pct == null) return "bg-muted/50 text-muted-foreground"
  if (first) return "bg-primary text-primary-foreground"
  if (pct >= 40) return "bg-primary/60 text-primary-foreground"
  if (pct >= 25) return "bg-primary/35"
  if (pct >= 10) return "bg-primary/15"
  if (pct > 0) return "bg-primary/[0.07]"
  return "bg-muted/60 text-muted-foreground"
}

export function CohortReport() {
  const [months, setMonths] = useState("6")
  const state = useBiReport<Data>("cohorts", { months })

  return (
    <ReportState state={state} kpis={3}>
      {({ cohorts, newCustomers }) => {
        const valid = cohorts.filter((c) => c.initialCount > 0)
        if (valid.length === 0) return <ReportEmpty icon={Users} title="Sin clientes nuevos identificados" hint="Las cohortes se forman con clientes asignados a sus ventas." />
        const maxCols = Math.max(...valid.map((c) => c.retention.length))
        // Retención promedio al mes 1 (ponderada por tamaño de cohorte).
        const m1 = valid.filter((c) => c.retention.length > 1)
        const m1Avg = m1.length ? m1.reduce((s, c) => s + (c.retention[1] ?? 0) * c.initialCount, 0) / m1.reduce((s, c) => s + c.initialCount, 0) : null
        const biggest = [...valid].sort((a, b) => b.initialCount - a.initialCount)[0]
        return (
          <>
            <KpiGrid cols={3}>
              <Kpi label="Clientes nuevos" value={fmt.int(newCustomers)} icon={UserPlus} tone="primary" emphasis hint={`últimos ${months} meses`} />
              <Kpi label="Regresan al mes siguiente" value={m1Avg == null ? "—" : fmt.pct(m1Avg)} icon={Repeat} tone="success" />
              <Kpi label="Mes con más altas" value={<span className="capitalize">{fmt.month(biggest.cohort)}</span>} hint={`${fmt.int(biggest.initialCount)} clientes`} icon={Users} />
            </KpiGrid>

            <ReportPanel
              title="Retención por cohorte"
              description="Cada fila agrupa a los clientes por el mes de su primera compra; cada columna muestra qué porcentaje volvió a comprar."
              actions={<SegmentedFilter options={WINDOWS} value={months} onChange={setMonths} ariaLabel="Ventana" />}
            >
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-1 text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="px-2 text-left font-medium">Cohorte</th>
                      <th className="px-2 text-right font-medium">Clientes</th>
                      {Array.from({ length: maxCols }, (_, i) => (
                        <th key={i} className="px-1 text-center font-medium">{i === 0 ? "Alta" : `Mes ${i}`}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {valid.map((row) => (
                      <tr key={row.cohort}>
                        <td className="whitespace-nowrap px-2 font-medium capitalize">{fmt.month(row.cohort)}</td>
                        <td className="px-2 text-right tabular-nums">{row.initialCount}</td>
                        {Array.from({ length: maxCols }, (_, i) => {
                          const pct = i < row.retention.length ? row.retention[i] : null
                          return (
                            <td key={i} className="p-0">
                              <div className={cn("flex h-9 min-w-12 items-center justify-center rounded-md font-semibold tabular-nums", cellClass(pct, i === 0))}>
                                {pct == null ? "" : `${Math.round(pct)}%`}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ReportPanel>

            <Insights
              items={[
                m1Avg != null && (
                  <>En promedio, <strong>{fmt.pct(m1Avg, 0)}</strong> de los clientes nuevos vuelve a comprar al mes siguiente.{m1Avg < 20 ? " Un mensaje o cupón después de la primera compra puede mejorar ese regreso." : ""}</>
                ),
              ]}
            />
          </>
        )
      }}
    </ReportState>
  )
}
