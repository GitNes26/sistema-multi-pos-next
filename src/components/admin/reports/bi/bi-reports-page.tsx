"use client"

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react"
import { useSearchParams } from "next/navigation"
import {
  AlertTriangle, ArrowRightLeft, BarChart3, Boxes, CalendarCheck2, Check, ChevronDown, Clock, CreditCard, Download,
  FileSpreadsheet, FileText, Globe, Layers, Package, PieChart, ShoppingCart, Star, Store, Tag, Target, TrendingUp,
  Trophy, Truck, UserCheck, Users, Wand2, type LucideIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PageHeader } from "@/components/layout/page-header"
import { cn } from "@/lib/utils"
import type { BiReportDefinition, BiReportId } from "@/lib/reports/bi-catalog"
import { ReportFiltersProvider } from "../report-kit"
import { ReportFiltersBar, useReportFiltersState } from "../report-filters-bar"
import { PeriodPulse } from "./period-pulse"
import { OmnichannelReport } from "./omnichannel-report"
import { HeatmapReport } from "./heatmap-report"
import { InventoryValuationReport } from "./inventory-valuation-report"
import { ProductRankingReport } from "./product-ranking-report"
import { CohortReport } from "./cohort-report"
import { EmployeeRankingReport } from "./employee-ranking-report"
import { LoyaltyReport } from "./loyalty-report"
import { CreditAgingReport } from "./credit-aging-report"
import { PromosRoiReport } from "./promos-roi-report"
import { DeliveryReport } from "./delivery-report"
import { LowStockReport } from "./low-stock-report"
import { SegmentationReport } from "./segmentation-report"
import { MarginReport } from "./margin-report"
import { DailyTrendReport } from "./daily-trend-report"
import { PaymentMixReport } from "./payment-mix-report"
import { ProductPairsReport } from "./product-pairs-report"
import { TransfersReport } from "./transfers-report"
import { FillRateReport } from "./fill-rate-report"
import { EmployeeMarginReport } from "./employee-margin-report"
import { ForecastReport } from "./forecast-report"
import { OperationalReport } from "./operational-report"

const REPORTS: Record<BiReportId, { icon: LucideIcon; Component: ComponentType }> = {
  daily_trend: { icon: BarChart3, Component: DailyTrendReport },
  omnichannel: { icon: Globe, Component: OmnichannelReport },
  heatmap: { icon: Clock, Component: HeatmapReport },
  payment_mix: { icon: CreditCard, Component: PaymentMixReport },
  margin: { icon: TrendingUp, Component: MarginReport },
  ranking: { icon: Trophy, Component: ProductRankingReport },
  product_pairs: { icon: Layers, Component: ProductPairsReport },
  promos_roi: { icon: Tag, Component: PromosRoiReport },
  forecast: { icon: Wand2, Component: ForecastReport },
  inventory: { icon: Package, Component: InventoryValuationReport },
  low_stock: { icon: ShoppingCart, Component: LowStockReport },
  fill_rate: { icon: Target, Component: FillRateReport },
  transfers: { icon: ArrowRightLeft, Component: TransfersReport },
  employee_ranking: { icon: UserCheck, Component: EmployeeRankingReport },
  employee_margin: { icon: UserCheck, Component: EmployeeMarginReport },
  delivery: { icon: Truck, Component: DeliveryReport },
  table_performance: { icon: Store, Component: () => <OperationalReport kind="table_performance" /> },
  appointments: { icon: CalendarCheck2, Component: () => <OperationalReport kind="appointments" /> },
  rentals: { icon: Boxes, Component: () => <OperationalReport kind="rentals" /> },
  cohorts: { icon: Users, Component: CohortReport },
  loyalty: { icon: Star, Component: LoyaltyReport },
  credit_aging: { icon: AlertTriangle, Component: CreditAgingReport },
  segmentation: { icon: PieChart, Component: SegmentationReport },
}

const GROUP_ORDER: BiReportDefinition["group"][] = ["Ventas", "Clientes", "Inventario", "Operación"]
// Orden de lectura dentro de cada grupo: primero lo más consultado.
const ORDER = Object.keys(REPORTS) as BiReportId[]

export function BiReportsPage({ canView }: { canView: boolean }) {
  const [catalog, setCatalog] = useState<BiReportDefinition[]>([])
  const searchParams = useSearchParams()
  // ?reporte=credit_aging abre directamente ese reporte (enlaces desde otras pantallas).
  const [active, setActive] = useState<BiReportId>(() => {
    const requested = searchParams.get("reporte") as BiReportId | null
    return requested && requested in REPORTS ? requested : "daily_trend"
  })
  const [exportOpen, setExportOpen] = useState(false)
  const [selected, setSelected] = useState<BiReportId[]>([])
  const filtersState = useReportFiltersState("30d")
  const { filters } = filtersState

  useEffect(() => {
    fetch("/api/reports/bi?report=catalog", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const reports: BiReportDefinition[] = data.reports ?? []
        setCatalog(reports)
        setSelected(reports.map((item) => item.id))
      })
      .catch(() => setCatalog([]))
  }, [])

  const groups = useMemo(
    () =>
      GROUP_ORDER.map((group) => ({
        group,
        items: catalog.filter((r) => r.group === group).sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id)),
      })).filter((g) => g.items.length > 0),
    [catalog]
  )

  useEffect(() => {
    if (catalog.length && !catalog.some((r) => r.id === active)) setActive(catalog[0].id)
  }, [catalog, active])

  // Centra el chip activo en la tira horizontal (tablet/teléfono) sin mover la página.
  const chipsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const strip = chipsRef.current
    const chip = strip?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!strip || !chip) return
    strip.scrollTo({ left: chip.offsetLeft - strip.clientWidth / 2 + chip.clientWidth / 2, behavior: "smooth" })
  }, [active, catalog])

  const definition = catalog.find((r) => r.id === active)
  const current = REPORTS[active]

  const query = (params: Record<string, string>) => {
    const p = new URLSearchParams(params)
    if (filters.from) p.set("from", filters.from)
    if (filters.to) p.set("to", filters.to)
    if (filters.locationId) p.set("locationId", filters.locationId)
    return p
  }
  const exportReport = (format: "xlsx" | "pdf") => window.open(`/api/reports/export?${query({ type: active, format })}`, "_blank")
  const exportPortfolio = () => {
    window.open(`/api/reports/export?${query({ format: "pdf", types: selected.join(",") })}`, "_blank")
    setExportOpen(false)
  }

  if (!canView) {
    return <div className="py-10 text-center text-muted-foreground">No tienes permiso para ver reportes</div>
  }

  return (
    <ReportFiltersProvider value={filters}>
      <PageHeader
        icon={<BarChart3 className="size-5" />}
        title="Inteligencia de negocio"
        description="Indicadores de ventas, clientes, inventario y operación con comparación contra el periodo anterior."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="size-4" /> Exportar <ChevronDown className="size-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-xs text-muted-foreground">{definition?.label ?? "Reporte actual"}</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => exportReport("xlsx")}>
                <FileSpreadsheet className="size-4" /> Excel de este reporte
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportReport("pdf")}>
                <FileText className="size-4" /> PDF de este reporte
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setExportOpen(true)}>
                <FileText className="size-4" /> Informe ejecutivo (varios)…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <ReportFiltersBar state={filtersState} />

      <PeriodPulse />

      <div className="mt-5 grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* Navegación: lista agrupada en escritorio, chips desplazables en tablet/teléfono */}
        <nav aria-label="Reportes" className="min-w-0 lg:sticky lg:top-[calc(7.5rem+env(safe-area-inset-top))] lg:self-start">
          <div ref={chipsRef} className="scrollbar-none relative -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4 lg:mx-0 lg:hidden">
            {groups.flatMap(({ items }) => items).map((r) => {
              const Icon = REPORTS[r.id]?.icon ?? BarChart3
              const on = r.id === active
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setActive(r.id)}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "press flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
                    on ? "border-transparent bg-primary text-primary-foreground shadow-e1" : "bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {r.label}
                </button>
              )
            })}
          </div>
          <div className="hidden space-y-5 lg:block">
            {groups.map(({ group, items }) => (
              <div key={group}>
                <p className="mb-1.5 px-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group}</p>
                <ul className="space-y-0.5">
                  {items.map((r) => {
                    const Icon = REPORTS[r.id]?.icon ?? BarChart3
                    const on = r.id === active
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => setActive(r.id)}
                          aria-current={on ? "page" : undefined}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                            on ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className="truncate">{r.label}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="min-w-0">
          {definition && (
            <div key={active} className="mb-4 flex animate-rise-in items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {(() => {
                  const Icon = current.icon
                  return <Icon className="size-5" />
                })()}
              </span>
              <div>
                <h2 className="font-heading text-lg font-semibold leading-tight">{definition.label}</h2>
                <p className="text-sm text-muted-foreground">{definition.description}</p>
              </div>
            </div>
          )}
          <div key={`${active}-body`} className="animate-rise-in">
            {catalog.length > 0 && <current.Component />}
          </div>
        </div>
      </div>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5" /> Crear informe ejecutivo PDF
            </DialogTitle>
            <DialogDescription>
              Reúne varios reportes en un solo documento con portada, identidad de la empresa, filtros, indicadores, análisis y tablas.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="max-h-[60vh] space-y-4">
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setSelected(catalog.map((r) => r.id))}>
                Seleccionar todos
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setSelected([])}>
                Limpiar
              </Button>
            </div>
            {groups.map(({ group, items }) => (
              <section key={group}>
                <h3 className="mb-2 text-sm font-semibold">{group}</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {items.map((report) => {
                    const checked = selected.includes(report.id)
                    return (
                      <button
                        type="button"
                        key={report.id}
                        role="checkbox"
                        aria-checked={checked}
                        onClick={() => setSelected((cur) => (checked ? cur.filter((id) => id !== report.id) : [...cur, report.id]))}
                        className={cn("flex min-h-16 items-start gap-3 rounded-xl border p-3 text-left transition-colors", checked ? "border-primary bg-primary/5" : "hover:bg-muted")}
                      >
                        <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border", checked && "border-primary bg-primary text-primary-foreground")}>
                          <Check className={cn("size-3", !checked && "opacity-0")} />
                        </span>
                        <span>
                          <strong className="block text-sm">{report.label}</strong>
                          <span className="line-clamp-2 text-xs text-muted-foreground">{report.description}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </DialogBody>
          <DialogFooter showCloseButton>
            <Button disabled={!selected.length} onClick={exportPortfolio}>
              <Download className="size-4" /> Exportar {selected.length} {selected.length === 1 ? "reporte" : "reportes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ReportFiltersProvider>
  )
}
