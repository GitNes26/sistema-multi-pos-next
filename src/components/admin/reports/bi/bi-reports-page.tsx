"use client"

import { useState } from "react"
import { BarChart3, Globe, Clock, Package, Trophy, Users, Download, FileText, UserCheck, Star, AlertTriangle, Tag, Truck, ShoppingCart, PieChart, TrendingUp, CreditCard, ArrowRightLeft, Layers, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
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

type Tab =
  | "omnichannel" | "heatmap" | "inventory" | "ranking" | "cohorts"
  | "employee_ranking" | "loyalty" | "credit_aging" | "promos_roi"
  | "delivery" | "low_stock" | "segmentation" | "margin"
  | "daily_trend" | "payment_mix" | "product_pairs" | "transfers"
  | "fill_rate" | "employee_margin" | "forecast"

const TABS: { value: Tab; label: string; icon: React.ReactNode }[] = [
  { value: "omnichannel", label: "Omnicanal", icon: <Globe className="size-4" /> },
  { value: "heatmap", label: "Heatmap", icon: <Clock className="size-4" /> },
  { value: "inventory", label: "Inventario", icon: <Package className="size-4" /> },
  { value: "ranking", label: "Productos", icon: <Trophy className="size-4" /> },
  { value: "cohorts", label: "Cohortes", icon: <Users className="size-4" /> },
  { value: "employee_ranking", label: "Empleados", icon: <UserCheck className="size-4" /> },
  { value: "loyalty", label: "Lealtad", icon: <Star className="size-4" /> },
  { value: "credit_aging", label: "Crédito", icon: <AlertTriangle className="size-4" /> },
  { value: "promos_roi", label: "Promos ROI", icon: <Tag className="size-4" /> },
  { value: "delivery", label: "Delivery", icon: <Truck className="size-4" /> },
  { value: "low_stock", label: "Stock Bajo", icon: <ShoppingCart className="size-4" /> },
  { value: "segmentation", label: "Segmentos", icon: <PieChart className="size-4" /> },
  { value: "margin", label: "Margen", icon: <TrendingUp className="size-4" /> },
  { value: "daily_trend", label: "Tendencia", icon: <BarChart3 className="size-4" /> },
  { value: "payment_mix", label: "Pagos", icon: <CreditCard className="size-4" /> },
  { value: "product_pairs", label: "Canasta", icon: <Layers className="size-4" /> },
  { value: "transfers", label: "Transferencias", icon: <ArrowRightLeft className="size-4" /> },
  { value: "fill_rate", label: "Fill Rate", icon: <Target className="size-4" /> },
  { value: "employee_margin", label: "Margen Emp.", icon: <UserCheck className="size-4" /> },
  { value: "forecast", label: "Pronóstico", icon: <TrendingUp className="size-4" /> },
]

interface Props { canView: boolean }

export function BiReportsPage({ canView }: Props) {
  const [tab, setTab] = useState<Tab>("omnichannel")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const exportReport = (format: "xlsx" | "pdf") => {
    const params = new URLSearchParams({ type: tab, format })
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    window.open(`/api/reports/export?${params}`, "_blank")
  }

  if (!canView) {
    return <div className="py-10 text-center text-muted-foreground">No tienes permiso para ver reportes</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-5 text-primary" />
          <h1 className="text-lg font-black">Business Intelligence</h1>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 rounded-lg border bg-background px-2 text-xs" />
          <span className="text-muted-foreground text-sm">a</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 rounded-lg border bg-background px-2 text-xs" />
          <Button variant="outline" size="sm" className="h-8" onClick={() => exportReport("xlsx")}>
            <Download className="size-3" /> Excel
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => exportReport("pdf")}>
            <FileText className="size-3" /> PDF
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              tab === t.value ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "omnichannel" && <OmnichannelReport from={from} to={to} />}
      {tab === "heatmap" && <HeatmapReport from={from} to={to} />}
      {tab === "inventory" && <InventoryValuationReport from={from} to={to} />}
      {tab === "ranking" && <ProductRankingReport from={from} to={to} />}
      {tab === "cohorts" && <CohortReport from={from} to={to} />}
      {tab === "employee_ranking" && <EmployeeRankingReport from={from} to={to} />}
      {tab === "loyalty" && <LoyaltyReport from={from} to={to} />}
      {tab === "credit_aging" && <CreditAgingReport from={from} to={to} />}
      {tab === "promos_roi" && <PromosRoiReport from={from} to={to} />}
      {tab === "delivery" && <DeliveryReport from={from} to={to} />}
      {tab === "low_stock" && <LowStockReport from={from} to={to} />}
      {tab === "segmentation" && <SegmentationReport from={from} to={to} />}
      {tab === "margin" && <MarginReport from={from} to={to} />}
      {tab === "daily_trend" && <DailyTrendReport from={from} to={to} />}
      {tab === "payment_mix" && <PaymentMixReport from={from} to={to} />}
      {tab === "product_pairs" && <ProductPairsReport from={from} to={to} />}
      {tab === "transfers" && <TransfersReport from={from} to={to} />}
      {tab === "fill_rate" && <FillRateReport from={from} to={to} />}
      {tab === "employee_margin" && <EmployeeMarginReport from={from} to={to} />}
      {tab === "forecast" && <ForecastReport from={from} to={to} />}
    </div>
  )
}
