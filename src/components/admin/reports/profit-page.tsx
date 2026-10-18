"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { AlertTriangle, Banknote, Calculator, HandCoins, PackageSearch, Receipt, ShoppingBag, TrendingDown, TrendingUp } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { SegmentedFilter } from "@/components/base/segmented-filter"
import { Button } from "@/components/ui/button"
import { BarList, Kpi, KpiGrid, ReportEmpty, ReportError, ReportPanel, ReportSkeleton, delta, fmt } from "./report-kit"
import { cn } from "@/lib/utils"
import type { ProfitSummary } from "@/lib/reports/profit"

type Preset = "today" | "7d" | "month" | "last-month" | "30d"

const PRESETS: { value: Preset; label: string }[] = [
  { value: "month", label: "Este mes" },
  { value: "last-month", label: "Mes anterior" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "today", label: "Hoy" },
]

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

function rangeFor(preset: Preset): { from: string; to: string; label: string } {
  const now = new Date()
  const today = ymd(now)
  if (preset === "today") return { from: today, to: today, label: "hoy" }
  if (preset === "7d") return { from: ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)), to: today, label: "estos 7 días" }
  if (preset === "30d") return { from: ymd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)), to: today, label: "estos 30 días" }
  if (preset === "last-month") {
    return { from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: ymd(new Date(now.getFullYear(), now.getMonth(), 0)), label: "el mes anterior" }
  }
  return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: today, label: "este mes" }
}

function Line({ label, value, sign, bold, hint }: { label: string; value: number; sign?: "+" | "-" | "="; bold?: boolean; hint?: ReactNode }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-2", bold && "border-t pt-3")}>
      <div className="min-w-0">
        <p className={cn("text-sm", bold ? "font-semibold" : "text-muted-foreground")}>
          {sign && <span className="mr-1.5 inline-block w-3 text-center font-bold">{sign}</span>}
          {label}
        </p>
        {hint && <p className="pl-[1.125rem] text-xs text-muted-foreground">{hint}</p>}
      </div>
      <p className={cn("shrink-0 tabular-nums", bold ? "text-lg font-bold" : "text-sm font-medium", bold && value < 0 && "text-destructive", bold && value > 0 && "text-success-ink")}>
        {fmt.money(value)}
      </p>
    </div>
  )
}

export function ProfitPage({ icon, canManageExpenses }: { icon: ReactNode; canManageExpenses: boolean }) {
  const [preset, setPreset] = useState<Preset>("month")
  const [data, setData] = useState<ProfitSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const range = useMemo(() => rangeFor(preset), [preset])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/reports/profit?from=${range.from}&to=${range.to}`, { cache: "no-store" })
      const body = await res.json()
      if (!res.ok || !body.ok) throw new Error(body.error ?? "No se pudo calcular tu ganancia")
      setData(body.summary as ProfitSummary)
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo calcular tu ganancia")
    } finally {
      setLoading(false)
    }
  }, [range.from, range.to])

  useEffect(() => {
    void load()
  }, [load])

  const c = data?.current
  const p = data?.previous
  const noActivity = !!c && c.tickets === 0 && c.operatingExpenses === 0 && c.merchandiseExpenses === 0

  return (
    <>
      <PageHeader
        icon={icon}
        title="Ganancias"
        description="Cuánto vendiste, cuánto te costó y cuánto gastaste: lo que realmente te quedó."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/admin/expenses">
                <Receipt className="size-4" /> {canManageExpenses ? "Registrar gastos" : "Ver gastos"}
              </Link>
            </Button>
          </div>
        }
      />

      <div className="mb-4">
        <SegmentedFilter ariaLabel="Periodo" options={PRESETS} value={preset} onChange={setPreset} />
      </div>

      {error ? (
        <ReportError message={error} onRetry={() => void load()} />
      ) : loading || !data || !c || !p ? (
        <ReportSkeleton kpis={4} />
      ) : noActivity ? (
        <ReportEmpty icon={TrendingUp} title="Aún no hay movimientos en este periodo" hint="Cuando vendas o registres gastos, aquí verás si ganaste o perdiste." />
      ) : (
        <div className="space-y-4">
          <section
            data-guide="profit-summary"
            className={cn(
              "rounded-2xl border p-5 sm:p-6",
              c.netProfit >= 0 ? "border-success/30 bg-success/[0.06]" : "border-destructive/30 bg-destructive/[0.06]"
            )}
            aria-live="polite"
          >
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              {c.netProfit >= 0 ? <TrendingUp className="size-4 text-success-ink" /> : <TrendingDown className="size-4 text-destructive" />}
              {data.itemsWithoutCost > 0
                ? `Ganancia estimada ${range.label}`
                : c.netProfit >= 0
                  ? `Ganaste ${range.label}`
                  : `Perdiste ${range.label}`}
            </p>
            <p className={cn("mt-1 font-heading text-4xl font-bold tracking-tight tabular-nums", c.netProfit >= 0 ? "text-success-ink" : "text-destructive")}>
              {fmt.money(Math.abs(c.netProfit))}
            </p>
            {data.itemsWithoutCost > 0 && (
              <p className="mt-1 text-sm font-medium text-warning-ink">
                Es una cifra de máximo: faltan costos de algunos productos, así que lo que realmente te quedó puede ser menor.
              </p>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              {p.netProfit === 0 && p.netSales === 0
                ? "Sin periodo anterior con el que comparar."
                : `Antes (${data.previousFrom} a ${data.previousTo}): ${p.netProfit >= 0 ? "ganaste" : "perdiste"} ${fmt.money(Math.abs(p.netProfit))}.`}
            </p>
          </section>

          {data.itemsWithoutCost > 0 && (
            <p className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-ink">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                Vendiste {fmt.int(data.itemsWithoutCost)} artículo(s) sin costo registrado ({data.itemsWithoutCostProducts.join(", ")}
                {data.itemsWithoutCostProducts.length >= 8 ? " y más" : ""}): su ganancia se cuenta completa y tu ganancia real puede ser menor.{" "}
                <Link href="/admin/products" className="font-semibold underline underline-offset-2">
                  Ponles su costo
                </Link>
              </span>
            </p>
          )}
          {data.expenseCount === 0 && (
            <p className="flex items-start gap-2 rounded-xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              <HandCoins className="mt-0.5 size-4 shrink-0" />
              <span>
                No has anotado gastos en este periodo (renta, luz, sueldos…). Es opcional, pero sin ellos la ganancia se ve mayor de lo que es.{" "}
                {canManageExpenses && (
                  <Link href="/admin/expenses" className="font-semibold text-foreground underline underline-offset-2">
                    Anotar un gasto
                  </Link>
                )}
              </span>
            </p>
          )}

          <KpiGrid>
            <Kpi label="Ventas netas" value={fmt.money(c.netSales)} icon={ShoppingBag} delta={delta(c.netSales, p.netSales)} hint={`${fmt.int(c.tickets)} ventas`} />
            <Kpi label="Costo de lo vendido" value={fmt.money(c.costOfGoods)} icon={PackageSearch} tone="warning" delta={delta(c.costOfGoods, p.costOfGoods)} inverse />
            <Kpi label="Ganancia de las ventas" value={fmt.money(c.grossProfit)} icon={Calculator} tone="info" delta={delta(c.grossProfit, p.grossProfit)} hint="antes de gastos" />
            <Kpi label="Gastos" value={fmt.money(c.operatingExpenses)} icon={Banknote} tone="danger" delta={delta(c.operatingExpenses, p.operatingExpenses)} inverse />
          </KpiGrid>

          <div className="grid gap-4 lg:grid-cols-2">
            <ReportPanel title="¿A dónde se fue el dinero?" description="Del total que vendiste a lo que te quedó.">
              <div className="divide-y">
                <Line label="Ventas" value={c.sales} />
                {c.refunds > 0 && <Line label="Devoluciones" value={c.refunds} sign="-" />}
                <Line label="Costo de lo que vendiste" value={c.costOfGoods} sign="-" hint="Lo que te costó la mercancía vendida" />
                <Line label="Gastos del negocio" value={c.operatingExpenses} sign="-" hint="Renta, luz, sueldos y demás" />
                <Line label={c.netProfit >= 0 ? "Lo que te quedó" : "Lo que perdiste"} value={c.netProfit} sign="=" bold />
              </div>
              {c.merchandiseExpenses > 0 && (
                <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Anotaste {fmt.money(c.merchandiseExpenses)} en «Mercancía e insumos». No se resta de nuevo porque esa mercancía ya está en el costo de lo que vendiste.
                </p>
              )}
            </ReportPanel>

            <ReportPanel title="Gastos por tipo" description={`${fmt.int(data.expenseCount)} gasto(s) anotado(s)`}>
              <BarList
                items={data.expensesByCategory.map((e) => ({ label: e.label, value: e.amount, display: fmt.money(e.amount), tone: "warning" as const }))}
                empty="Sin gastos anotados en este periodo"
              />
            </ReportPanel>

            <ReportPanel title="Lo que más te deja" description="Productos con más ganancia (con costo capturado).">
              <BarList
                items={data.topProducts.map((r) => ({
                  label: r.name,
                  value: Math.max(0, r.profit),
                  display: fmt.money(r.profit),
                  secondary: `${fmt.pct(r.marginPct)} de ganancia · ${fmt.num(r.units, 2)} vendidos`,
                  tone: "success" as const,
                }))}
                empty="Pon costo a tus productos para ver cuáles te dejan más"
              />
            </ReportPanel>

            <ReportPanel title="Lo que menos te deja" description="Ojo con los que dejan poco o pierden.">
              <BarList
                items={data.worstProducts.map((r) => ({
                  label: r.name,
                  value: Math.max(0, r.profit),
                  display: fmt.money(r.profit),
                  secondary: `${fmt.pct(r.marginPct)} de ganancia · ${fmt.num(r.units, 2)} vendidos`,
                  tone: r.profit < 0 ? ("danger" as const) : ("warning" as const),
                }))}
                empty="Pon costo a tus productos para ver cuáles te dejan menos"
              />
              {data.soldBelowCost.length > 0 && (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  Vendiste por debajo de su costo: {data.soldBelowCost.map((s) => `${s.name} (vendido ${fmt.money(s.price)}, costó ${fmt.money(s.cost)})`).join("; ")}.
                </p>
              )}
            </ReportPanel>
          </div>
        </div>
      )}
    </>
  )
}
