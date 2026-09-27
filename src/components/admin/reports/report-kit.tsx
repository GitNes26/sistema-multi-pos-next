"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, BarChart3, Lightbulb, Minus, RefreshCw, TriangleAlert, type LucideIcon } from "lucide-react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { money } from "@/lib/pos/money"
import { cn } from "@/lib/utils"

// Kit compartido de reportes: filtros en contexto, carga de datos, KPIs con
// comparación, paneles, tabla ordenable, barras, gráficas e ideas clave.
// Todos los reportes (BI y generales) se construyen con estas piezas para
// que un cambio de diseño aquí se refleje en todos.

// ── Formato ─────────────────────────────────────────────────────────────

export const fmt = {
  money: (n: number | null | undefined) => money(Number(n ?? 0)),
  /** Moneda compacta para ejes: $12.5 k, $1.2 M. */
  moneyShort: (n: number) =>
    Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toLocaleString("es-MX", { maximumFractionDigits: 1 })} M`
      : Math.abs(n) >= 1000 ? `$${(n / 1000).toLocaleString("es-MX", { maximumFractionDigits: 1 })} k`
        : `$${Math.round(n)}`,
  int: (n: number | null | undefined) => Math.round(Number(n ?? 0)).toLocaleString("es-MX"),
  num: (n: number | null | undefined, digits = 2) => Number(n ?? 0).toLocaleString("es-MX", { maximumFractionDigits: digits }),
  pct: (n: number | null | undefined, digits = 1) => (n == null ? "—" : `${Number(n).toLocaleString("es-MX", { maximumFractionDigits: digits })}%`),
  minutes: (n: number | null | undefined) => (n == null ? "—" : n >= 60 ? `${Math.floor(n / 60)} h ${Math.round(n % 60)} min` : `${Math.round(n)} min`),
  /** "2026-09-25" → "25 sep" */
  day: (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX", { day: "numeric", month: "short" }),
  dayLong: (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" }),
  month: (ym: string) => new Date(`${ym}-15T12:00:00`).toLocaleDateString("es-MX", { month: "short", year: "2-digit" }),
}

/** Variación porcentual entre dos valores (null si no hay base). */
export function delta(current: number, previous: number): number | null {
  if (!previous) return current ? null : 0
  return ((current - previous) / Math.abs(previous)) * 100
}

// ── Filtros compartidos ─────────────────────────────────────────────────

export interface ReportFilters {
  from: string
  to: string
  locationId: string
}

const FiltersContext = createContext<ReportFilters>({ from: "", to: "", locationId: "" })

export function ReportFiltersProvider({ value, children }: { value: ReportFilters; children: ReactNode }) {
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>
}

export const useReportFilters = () => useContext(FiltersContext)

// ── Datos ───────────────────────────────────────────────────────────────

/** Carga un reporte BI con los filtros del contexto (más parámetros propios). */
export function useBiReport<T>(report: string, extra?: Record<string, string | number | undefined>) {
  const { from, to, locationId } = useReportFilters()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const extraKey = JSON.stringify(extra ?? {})

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ report })
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    if (locationId) params.set("locationId", locationId)
    for (const [k, v] of Object.entries(JSON.parse(extraKey) as Record<string, string | number | undefined>)) {
      if (v !== undefined && v !== "") params.set(k, String(v))
    }
    setLoading(true)
    setError(null)
    fetch(`/api/reports/bi?${params}`, { credentials: "include", signal: controller.signal })
      .then(async (r) => {
        const body = await r.json().catch(() => null)
        if (!r.ok || !body?.ok) throw new Error(body?.error ?? "No se pudo cargar el reporte")
        setData(body as T)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : "No se pudo cargar el reporte")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [report, from, to, locationId, extraKey, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { data, loading, error, reload }
}

// ── Estados ─────────────────────────────────────────────────────────────

export function ReportSkeleton({ kpis = 4 }: { kpis?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className={cn("grid gap-3", kpis >= 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-3")}>
        {Array.from({ length: kpis }).map((_, i) => (
          <Skeleton key={i} className="h-[5.5rem] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  )
}

export function ReportError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
      <TriangleAlert className="size-8 text-destructive" />
      <p className="max-w-sm text-sm">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-4" /> Reintentar
        </Button>
      )}
    </div>
  )
}

export function ReportEmpty({ icon: Icon = BarChart3, title = "Sin datos en este periodo", hint }: { icon?: LucideIcon; title?: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </span>
      <p className="font-medium">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Envoltura de estado: esqueleto → error → contenido. */
export function ReportState<T>({
  state,
  kpis,
  children,
}: {
  state: { data: T | null; loading: boolean; error: string | null; reload: () => void }
  kpis?: number
  children: (data: T) => ReactNode
}) {
  if (state.loading && !state.data) return <ReportSkeleton kpis={kpis} />
  if (state.error) return <ReportError message={state.error} onRetry={state.reload} />
  if (!state.data) return <ReportEmpty />
  return <div className={cn("space-y-4 transition-opacity", state.loading && "pointer-events-none opacity-60")}>{children(state.data)}</div>
}

// ── KPIs ────────────────────────────────────────────────────────────────

type Tone = "default" | "primary" | "success" | "warning" | "danger" | "info"

const TONE_ICON: Record<Tone, string> = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/12 text-primary",
  success: "bg-success/12 text-success-ink",
  warning: "bg-warning/15 text-warning-ink",
  danger: "bg-destructive/12 text-destructive",
  info: "bg-info/12 text-info-ink",
}

export function KpiGrid({ children, cols = 4, className }: { children: ReactNode; cols?: 2 | 3 | 4 | 5 | 6; className?: string }) {
  return (
    <div
      className={cn(
        "grid gap-3",
        cols === 2 && "grid-cols-2",
        cols === 3 && "grid-cols-2 lg:grid-cols-3",
        cols === 4 && "grid-cols-2 lg:grid-cols-4",
        cols === 5 && "grid-cols-2 md:grid-cols-3 xl:grid-cols-5",
        cols === 6 && "grid-cols-2 md:grid-cols-3 xl:grid-cols-6",
        className
      )}
    >
      {children}
    </div>
  )
}

export function DeltaBadge({ value, inverse = false, className }: { value: number | null; inverse?: boolean; className?: string }) {
  if (value == null) return <span className={cn("text-xs text-muted-foreground", className)}>sin base previa</span>
  const flat = Math.abs(value) < 0.5
  const good = inverse ? value < 0 : value > 0
  const Icon = flat ? Minus : value > 0 ? ArrowUp : ArrowDown
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        flat ? "bg-muted text-muted-foreground" : good ? "bg-success/12 text-success-ink" : "bg-destructive/12 text-destructive",
        className
      )}
    >
      <Icon className="size-3" strokeWidth={2.5} />
      {fmt.pct(Math.abs(value), Math.abs(value) >= 10 ? 0 : 1)}
    </span>
  )
}

export function Kpi({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
  delta: change,
  inverse,
  emphasis,
}: {
  label: string
  value: ReactNode
  icon?: LucideIcon
  hint?: ReactNode
  tone?: Tone
  /** Variación % contra el periodo anterior. */
  delta?: number | null
  /** Si bajar es bueno (p. ej. cancelaciones). */
  inverse?: boolean
  emphasis?: boolean
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2 rounded-2xl border bg-card p-4 shadow-e1", emphasis && "border-primary/30 bg-primary/[0.04]")}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", TONE_ICON[tone])}>
            <Icon className="size-3.5" />
          </span>
        )}
      </div>
      <p className="truncate font-heading text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{value}</p>
      {(change !== undefined || hint) && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {change !== undefined && <DeltaBadge value={change} inverse={inverse} />}
          {hint && <span className="truncate">{hint}</span>}
        </div>
      )}
    </div>
  )
}

// ── Paneles ─────────────────────────────────────────────────────────────

export function ReportPanel({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  bodyClassName,
  flush,
}: {
  title: ReactNode
  description?: ReactNode
  icon?: LucideIcon
  actions?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  /** Sin relleno interno (tablas a sangre). */
  flush?: boolean
}) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border bg-card shadow-e1", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 pb-3 sm:px-5">
        <div className="flex min-w-0 items-start gap-2.5">
          {Icon && (
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-3.5" />
            </span>
          )}
          <div className="min-w-0">
            <h3 className="font-semibold leading-tight">{title}</h3>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className={cn(!flush && "px-4 pb-4 sm:px-5 sm:pb-5", bodyClassName)}>{children}</div>
    </section>
  )
}

export function Insights({ items, title = "Lo más relevante" }: { items: (ReactNode | false | null | undefined)[]; title?: string }) {
  const list = items.filter(Boolean)
  if (list.length === 0) return null
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/[0.05] p-4 sm:p-5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="flex size-6 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Lightbulb className="size-3.5" />
        </span>
        {title}
      </p>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed">
        {list.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
            <span className="min-w-0">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Barras ──────────────────────────────────────────────────────────────

const BAR_TONE: Record<Tone, string> = {
  default: "bg-foreground/70",
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
}

export interface BarItem {
  label: ReactNode
  value: number
  display: ReactNode
  secondary?: ReactNode
  tone?: Tone
}

/** Ranking horizontal: etiqueta, barra proporcional y valor. */
export function BarList({ items, max, empty }: { items: BarItem[]; max?: number; empty?: string }) {
  const top = max ?? Math.max(...items.map((i) => i.value), 0)
  if (items.length === 0) return <ReportEmpty title={empty ?? "Sin datos en este periodo"} />
  return (
    <ul className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium">{item.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{item.display}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-[width] duration-700 ease-out-quart", BAR_TONE[item.tone ?? "primary"])}
              style={{ width: `${top > 0 ? Math.max(1.5, (Math.max(0, item.value) / top) * 100) : 0}%` }}
            />
          </div>
          {item.secondary && <p className="text-xs text-muted-foreground">{item.secondary}</p>}
        </li>
      ))}
    </ul>
  )
}

const SHARE_COLORS = ["bg-primary", "bg-info", "bg-success", "bg-warning", "bg-destructive/80", "bg-foreground/50"]

/** Barra de participación (100 %) con leyenda. */
export function ShareBar({ segments }: { segments: { label: string; value: number; display?: string }[] }) {
  const total = segments.reduce((s, x) => s + Math.max(0, x.value), 0)
  if (total <= 0) return null
  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        {segments.map((s, i) => (
          <div
            key={s.label}
            title={`${s.label}: ${fmt.pct((s.value / total) * 100)}`}
            className={cn("h-full transition-[width] duration-700 ease-out-quart first:rounded-l-full last:rounded-r-full", SHARE_COLORS[i % SHARE_COLORS.length])}
            style={{ width: `${(Math.max(0, s.value) / total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        {segments.map((s, i) => (
          <li key={s.label} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", SHARE_COLORS[i % SHARE_COLORS.length])} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="font-semibold tabular-nums">{s.display ?? fmt.pct((s.value / total) * 100)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Gráfica de serie ────────────────────────────────────────────────────

export interface ChartSeries {
  key: string
  label: string
  kind?: "area" | "bar" | "line"
  color?: string
  /** Eje derecho (p. ej. número de tickets junto a importes). */
  right?: boolean
}

export function SeriesChart({
  data,
  xKey,
  series,
  format = fmt.money,
  rightFormat = fmt.int,
  xFormat,
  height = 260,
}: {
  data: object[]
  xKey: string
  series: ChartSeries[]
  format?: (n: number) => string
  rightFormat?: (n: number) => string
  xFormat?: (v: string) => string
  height?: number
}) {
  const hasRight = series.some((s) => s.right)
  const onlyArea = series.every((s) => (s.kind ?? "area") === "area")
  const onlyBar = series.every((s) => s.kind === "bar")
  const Chart = onlyArea ? AreaChart : onlyBar ? BarChart : ComposedChart
  const gradientId = useMemo(() => `g${Math.random().toString(36).slice(2, 8)}`, [])

  return (
    <div style={{ height }} className="-ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data} margin={{ top: 8, right: hasRight ? 0 : 8, left: 0, bottom: 0 }}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.key} id={`${gradientId}-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color ?? "var(--primary)"} stopOpacity={0.28} />
                <stop offset="100%" stopColor={s.color ?? "var(--primary)"} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={xKey} fontSize={11} tickLine={false} axisLine={false} minTickGap={16} tickFormatter={xFormat} />
          <YAxis yAxisId="l" fontSize={11} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => (format === fmt.money ? fmt.moneyShort(Number(v)) : format(Number(v)))} />
          {hasRight && <YAxis yAxisId="r" orientation="right" fontSize={11} tickLine={false} axisLine={false} width={36} tickFormatter={(v) => rightFormat(Number(v))} />}
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.5 }}
            labelFormatter={(v) => (xFormat ? xFormat(String(v)) : String(v))}
            formatter={(value, name) => {
              const s = series.find((x) => x.label === name)
              return [s?.right ? rightFormat(Number(value)) : format(Number(value)), name]
            }}
          />
          {series.map((s, i) => {
            const color = s.color ?? "var(--primary)"
            const axis = s.right ? "r" : "l"
            if ((s.kind ?? "area") === "bar") return <Bar key={s.key} yAxisId={axis} dataKey={s.key} name={s.label} fill={color} radius={[4, 4, 0, 0]} maxBarSize={36} />
            if (s.kind === "line") return <Line key={s.key} yAxisId={axis} type="monotone" dataKey={s.key} name={s.label} stroke={color} strokeWidth={2} dot={false} />
            return <Area key={s.key} yAxisId={axis} type="monotone" dataKey={s.key} name={s.label} stroke={color} strokeWidth={2} fill={`url(#${gradientId}-${i})`} />
          })}
        </Chart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Tabla ───────────────────────────────────────────────────────────────

export interface ReportColumn<T> {
  key: string
  label: string
  align?: "left" | "right" | "center"
  /** Valor para ordenar (por defecto row[key]). */
  value?: (row: T) => number | string | null
  render?: (row: T) => ReactNode
  /** Barra proporcional de fondo en la celda (columnas numéricas). */
  bar?: boolean
  className?: string
  /** Se oculta en pantallas angostas. */
  hideOnMobile?: boolean
}

export function ReportTable<T>({
  columns,
  rows,
  rowKey,
  defaultSort,
  limit,
  empty = "Sin registros para los filtros seleccionados",
  footer,
}: {
  columns: ReportColumn<T>[]
  rows: T[]
  rowKey: (row: T, index: number) => string
  defaultSort?: { key: string; dir: "asc" | "desc" }
  limit?: number
  empty?: string
  footer?: ReactNode
}) {
  const [sort, setSort] = useState(defaultSort ?? null)
  const [expanded, setExpanded] = useState(false)

  const read = useCallback(
    (row: T, col: ReportColumn<T>) => (col.value ? col.value(row) : ((row as Record<string, unknown>)[col.key] as number | string | null)),
    []
  )

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return rows
    return [...rows].sort((a, b) => {
      const va = read(a, col)
      const vb = read(b, col)
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va ?? "").localeCompare(String(vb ?? ""), "es")
      return sort.dir === "asc" ? cmp : -cmp
    })
  }, [rows, sort, columns, read])

  const maxByCol = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of columns) if (c.bar) m[c.key] = Math.max(0, ...rows.map((r) => Number(read(r, c) ?? 0)))
    return m
  }, [columns, rows, read])

  const visible = limit && !expanded ? sorted.slice(0, limit) : sorted

  if (rows.length === 0) return <ReportEmpty title={empty} />

  const toggle = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }))

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="data-grid w-full text-sm">
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                    className={cn(
                      "first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5",
                      c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                      c.hideOnMobile && "max-sm:hidden"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggle(c.key)}
                      className={cn("inline-flex items-center gap-1 rounded hover:text-foreground", active && "text-foreground")}
                    >
                      {c.label}
                      {active ? (
                        sort!.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                      ) : (
                        <ArrowUpDown className="size-3 opacity-40" />
                      )}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={rowKey(row, i)}>
                {columns.map((c) => {
                  const raw = read(row, c)
                  const max = maxByCol[c.key]
                  return (
                    <td
                      key={c.key}
                      className={cn(
                        "relative whitespace-nowrap first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5",
                        c.align === "right" ? "text-right tabular-nums" : c.align === "center" ? "text-center" : "text-left",
                        c.hideOnMobile && "max-sm:hidden",
                        c.className
                      )}
                    >
                      {c.bar && max > 0 && (
                        <span
                          aria-hidden
                          className="absolute inset-y-1.5 right-2 rounded-md bg-primary/10"
                          style={{ width: `calc(${(Math.max(0, Number(raw ?? 0)) / max) * 100}% - 1rem)` }}
                        />
                      )}
                      <span className="relative">{c.render ? c.render(row) : raw == null ? "—" : String(raw)}</span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(footer || (limit && rows.length > limit)) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
          <span>{footer ?? `${fmt.int(rows.length)} registros`}</span>
          {limit && rows.length > limit && (
            <Button variant="ghost" size="sm" className="h-8" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Ver menos" : `Ver los ${fmt.int(rows.length)}`}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
