"use client"

import Link from "next/link"
import { ArrowRight, PackageCheck, PackageX, ShoppingCart, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusPill } from "@/components/base/status-pill"
import { Kpi, KpiGrid, ReportEmpty, ReportPanel, ReportState, ReportTable, fmt, useBiReport } from "../report-kit"

interface Row { productId: string; productName: string; locationName: string; currentStock: number; minStock: number; maxStock: number; deficit: number; coveragePct: number }
interface Data { rows: Row[]; totals: { alerts: number; empty: number; unitsToOrder: number } }

export function LowStockReport() {
  const state = useBiReport<Data>("low_stock")

  return (
    <ReportState state={state} kpis={3}>
      {({ rows, totals: t }) => (
        <>
          <KpiGrid cols={3}>
            <Kpi label="Alertas activas" value={fmt.int(t.alerts)} icon={TriangleAlert} tone={t.alerts > 0 ? "warning" : "success"} emphasis />
            <Kpi label="Agotados" value={fmt.int(t.empty)} icon={PackageX} tone={t.empty > 0 ? "danger" : "default"} />
            <Kpi label="Unidades sugeridas a reponer" value={fmt.num(t.unitsToOrder, 0)} icon={ShoppingCart} hint="hasta el doble del mínimo" />
          </KpiGrid>

          {rows.length === 0 ? (
            <ReportPanel title="Existencias bajo el mínimo">
              <ReportEmpty icon={PackageCheck} title="Todo en orden" hint="Ningún producto está por debajo de su mínimo configurado." />
            </ReportPanel>
          ) : (
            <ReportPanel
              title="Existencias bajo el mínimo"
              description="Ordenadas de la más crítica a la menos crítica."
              actions={
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/purchasing">
                    Crear orden de compra <ArrowRight className="size-4" />
                  </Link>
                </Button>
              }
              flush
            >
              <ReportTable
                rows={rows}
                rowKey={(r, i) => `${r.productId}-${r.locationName}-${i}`}
                limit={25}
                columns={[
                  {
                    key: "productName",
                    label: "Producto",
                    render: (r) => (
                      <span className="block max-w-[16rem] truncate">
                        <span className="font-medium">{r.productName}</span>
                        <span className="block text-xs text-muted-foreground">{r.locationName}</span>
                      </span>
                    ),
                  },
                  {
                    key: "coveragePct",
                    label: "Nivel",
                    value: (r) => r.coveragePct,
                    render: (r) => (
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <span
                            className={r.currentStock <= 0 ? "block h-full bg-destructive" : "block h-full bg-warning"}
                            style={{ width: `${Math.min(100, r.coveragePct)}%` }}
                          />
                        </span>
                        {r.currentStock <= 0 ? <StatusPill tone="danger">Agotado</StatusPill> : <StatusPill tone="warning">{fmt.pct(r.coveragePct, 0)}</StatusPill>}
                      </span>
                    ),
                  },
                  { key: "currentStock", label: "Existencia", align: "right", render: (r) => <strong>{fmt.num(r.currentStock)}</strong> },
                  { key: "minStock", label: "Mínimo", align: "right", render: (r) => fmt.num(r.minStock), hideOnMobile: true },
                  { key: "deficit", label: "Reponer", align: "right", render: (r) => <span className="font-semibold text-primary">+{fmt.num(r.deficit)}</span> },
                ]}
              />
            </ReportPanel>
          )}
        </>
      )}
    </ReportState>
  )
}
