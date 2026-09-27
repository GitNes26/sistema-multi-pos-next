"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowRight, Banknote, BarChart3, Bell, Boxes, ChevronDown, ClipboardList, Download, FileDown, FileSpreadsheet,
  Landmark, Loader2, PackageCheck, Receipt, ReceiptText, RotateCcw, Scale, ShoppingBag, Tag, TrendingUp, Truck,
  UserRound, Users, Wallet, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/base/data-table";
import { StatusPill } from "@/components/base/status-pill";
import { EntityCell } from "@/components/base/entity-cell";
import { OrderStatusPill, ORDER_STATUS_TONE } from "@/components/shared/order-status-pill";
import { CreditStatusPill } from "@/components/shared/status-pills";
import { ORDER_STATUS_LABELS, type OrderStatusKey } from "@/lib/orders/client";
import {
  crudApi, reportsApi, type CashReportRow, type CreditReportRow, type CustomersReportRow, type OrdersReportRow,
  type ReportFilters as ApiFilters, type ReportType, type SalesReportRow,
} from "@/lib/api";
import { swalError, swalToast } from "@/lib/swal";
import { cn } from "@/lib/utils";
import {
  BarList, Insights, Kpi, KpiGrid, ReportFiltersProvider, ReportPanel, ReportSkeleton, SeriesChart, ShareBar, fmt, useReportFilters,
} from "./report-kit";
import { ReportFiltersBar, useReportFiltersState } from "./report-filters-bar";

// Reportes operativos (transaccionales): ventas, cortes de caja, pedidos,
// clientes y cartera. El análisis profundo vive en Inteligencia de negocio.

type ReportTab = "sales" | "cash" | "orders" | "customers" | "credit";

const TABS: { value: ReportTab; label: string; icon: typeof ReceiptText }[] = [
  { value: "sales", label: "Ventas", icon: ReceiptText },
  { value: "cash", label: "Cortes de caja", icon: Boxes },
  { value: "orders", label: "Pedidos", icon: ClipboardList },
  { value: "customers", label: "Clientes", icon: Users },
  { value: "credit", label: "Crédito", icon: Landmark },
];

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Efectivo", card: "Tarjeta", wallet: "Monedero / transferencia", points: "Puntos", credit: "Crédito", other: "Otro",
};

interface ExtraFilters { employeeId: string; cashRegisterId: string }

interface ReportsPageProps {
  canView: boolean;
  canExport: boolean;
  icon?: React.ReactNode;
}

export function ReportsPage({ canView, canExport, icon }: ReportsPageProps) {
  const [tab, setTab] = useState<ReportTab>("sales");
  const filtersState = useReportFiltersState("30d");
  const [extra, setExtra] = useState<ExtraFilters>({ employeeId: "", cashRegisterId: "" });
  const [options, setOptions] = useState<{ employees: Option[]; registers: Option[] }>({ employees: [], registers: [] });
  const [busy, setBusy] = useState<"xlsx" | "pdf" | null>(null);

  useEffect(() => {
    if (!canView) return;
    const active = (rows: Record<string, unknown>[], label: string) =>
      rows.filter((x) => x.isActive !== false && x.active !== false).map((x) => ({ id: String(x.id), name: String(x[label] ?? "") }));
    Promise.all([crudApi.list("employees", { pageSize: 250 }), crudApi.list("cashRegisters", { pageSize: 250 })])
      .then(([e, r]) => setOptions({ employees: active(e.rows, "fullName"), registers: active(r.rows, "name") }))
      .catch(() => undefined);
  }, [canView]);

  const apiFilters = useCallback((): ApiFilters => {
    const { from, to, locationId } = filtersState.filters;
    const p: ApiFilters = {};
    if (from) p.from = from;
    if (to) p.to = to;
    if (locationId) p.locationId = locationId;
    if (extra.employeeId && (tab === "sales")) p.employeeId = extra.employeeId;
    if (extra.cashRegisterId && tab === "sales") p.cashRegisterId = extra.cashRegisterId;
    return p;
  }, [filtersState.filters, extra, tab]);

  const handleExport = async (format: "xlsx" | "pdf") => {
    if (!canExport) {
      swalError("Sin permiso", "No tienes permiso para exportar reportes.");
      return;
    }
    setBusy(format);
    try {
      await reportsApi.export(tab as ReportType, format, apiFilters());
      swalToast("Reporte exportado");
    } catch (err) {
      swalError("No se pudo exportar", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  if (!canView) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">No tienes permiso para ver los reportes.</CardContent>
      </Card>
    );
  }

  return (
    <ReportFiltersProvider value={filtersState.filters}>
      <PageHeader
        icon={icon}
        title="Reportes"
        description="Ventas, cortes de caja, pedidos, clientes y crédito con filtros y exportación."
        actions={
          <>
            <Button asChild variant="ghost">
              <Link href="/admin/reports/bi">
                <BarChart3 className="size-4" /> Inteligencia de negocio
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={busy !== null}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  Exportar <ChevronDown className="size-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => handleExport("xlsx")}>
                  <FileSpreadsheet className="size-4" /> Excel
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleExport("pdf")}>
                  <FileDown className="size-4" /> PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div role="tablist" aria-label="Reporte" className="scrollbar-none -mx-3 mb-3 flex gap-2 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        {TABS.map((t) => {
          const on = t.value === tab;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(t.value)}
              className={cn(
                "press flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
                on ? "border-transparent bg-primary text-primary-foreground shadow-e1" : "bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab !== "credit" && <ReportFiltersBar
        state={filtersState}
        extra={
          tab === "sales" ? (
            <>
              <OptionSelect placeholder="Todos los empleados" options={options.employees} value={extra.employeeId} onChange={(v) => setExtra((e) => ({ ...e, employeeId: v }))} />
              <OptionSelect placeholder="Todas las cajas" options={options.registers} value={extra.cashRegisterId} onChange={(v) => setExtra((e) => ({ ...e, cashRegisterId: v }))} />
            </>
          ) : undefined
        }
      />}
      {tab === "credit" && <p className="mb-4 text-sm text-muted-foreground">Saldos vigentes al día de hoy (no dependen del periodo).</p>}

      <div key={tab} className="animate-rise-in space-y-4">
        {tab === "sales" && <SalesTab filters={apiFilters} />}
        {tab === "cash" && <CashTab filters={apiFilters} />}
        {tab === "orders" && <OrdersTab filters={apiFilters} />}
        {tab === "customers" && <CustomersTab filters={apiFilters} />}
        {tab === "credit" && <CreditTab />}
      </div>
    </ReportFiltersProvider>
  );
}

// ── Utilidades ──────────────────────────────────────────────────────────

interface Option { id: string; name: string }

function OptionSelect({ placeholder, options, value, onChange }: { placeholder: string; options: Option[]; value: string; onChange: (v: string) => void }) {
  if (options.length === 0) return null;
  return (
    <Select value={value || "all"} onValueChange={(v) => onChange(v === "all" ? "" : v)}>
      <SelectTrigger className="w-auto min-w-40" aria-label={placeholder}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Carga un reporte general; se vuelve a pedir al cambiar los filtros. */
function useGeneral<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const run = useCallback(() => {
    setLoading(true);
    load()
      .then(setData)
      .catch((err) => swalError("No se pudo cargar el reporte", err instanceof Error ? err.message : undefined))
      .finally(() => setLoading(false));
  }, [load]);
  useEffect(() => run(), [run]);
  return { data, loading, reload: run };
}

const dateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

// ── Ventas ──────────────────────────────────────────────────────────────

function SalesTab({ filters }: { filters: () => ApiFilters }) {
  const load = useCallback(() => reportsApi.sales(filters()), [filters]);
  const { data, loading, reload } = useGeneral(load);
  const { from, to } = useReportFilters();
  if (!data) return <ReportSkeleton />;
  const t = data.totals;

  // Serie con los días sin venta en cero, para que la gráfica no mienta.
  const series: { day: string; total: number; count: number }[] = [];
  const byDay = new Map(data.byDay.map((d) => [d.day, d]));
  const cursor = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  for (let i = 0; cursor <= end && i < 400; i++) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    series.push({ day: key, total: byDay.get(key)?.total ?? 0, count: byDay.get(key)?.count ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  const hours = data.byHour.filter((h) => h.count > 0);

  return (
    <div className={cn("space-y-4 transition-opacity", loading && "opacity-60")}>
      <KpiGrid cols={4}>
        <Kpi label="Venta neta" value={fmt.money(t.netTotal)} icon={TrendingUp} tone="primary" emphasis hint={t.refundsTotal > 0 ? `Devoluciones ${fmt.money(t.refundsTotal)}` : "sin devoluciones"} />
        <Kpi label="Ventas" value={fmt.int(t.count)} icon={Receipt} hint={`Bruto ${fmt.money(t.total)}`} />
        <Kpi label="Ticket promedio" value={fmt.money(t.avgTicket)} icon={ShoppingBag} />
        <Kpi label="Descuentos" value={fmt.money(t.discount)} icon={Tag} tone="warning" hint={`Impuestos ${fmt.money(t.tax)}`} />
      </KpiGrid>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ReportPanel title="Ventas por día" description="Importe y número de ventas">
          <SeriesChart
            data={series}
            xKey="day"
            xFormat={fmt.day}
            series={[
              { key: "total", label: "Ventas" },
              { key: "count", label: "Tickets", kind: "line", color: "var(--info)", right: true },
            ]}
          />
        </ReportPanel>
        <ReportPanel title="Formas de pago" icon={Wallet}>
          <ShareBar segments={data.byPayment.map((p) => ({ label: PAYMENT_LABELS[p.method] ?? p.method, value: p.amount }))} />
          <div className="mt-4">
            <BarList
              items={data.byPayment.map((p) => ({
                label: PAYMENT_LABELS[p.method] ?? p.method,
                value: p.amount,
                display: fmt.money(p.amount),
                secondary: `${fmt.int(p.count)} pagos`,
              }))}
              empty="Sin pagos"
            />
          </div>
        </ReportPanel>
      </div>

      {hours.length > 0 && (
        <Insights
          items={[
            (() => {
              const peak = [...data.byHour].sort((a, b) => b.total - a.total)[0];
              return <>La hora con más venta es <strong>{peak.hour}:00</strong> ({fmt.money(peak.total)} en el periodo).</>;
            })(),
            t.pointsEarned > 0 && <>Tus clientes ganaron <strong>{fmt.int(t.pointsEarned)}</strong> puntos de lealtad.</>,
          ]}
        />
      )}

      <DataTable
        columns={salesColumns}
        data={data.rows}
        searchable
        searchPlaceholder="Buscar folio, cliente o cajero…"
        showColumnVisibility={false}
        pageSize={20}
        loading={loading}
        emptyMessage="Sin ventas para los filtros"
        rowKey={(r) => r.id}
        onRefresh={reload}
        refreshing={loading}
      />
    </div>
  );
}

const salesColumns = [
  { id: "folio", accessorFn: (r: SalesReportRow) => `${r.folio} ${r.customerName ?? ""} ${r.employeeName ?? ""}`, header: "Folio", cell: ({ row }: { row: { original: SalesReportRow } }) => <span className="font-semibold tabular-nums">#{row.original.folio}</span> },
  { id: "fecha", header: "Fecha", cell: ({ row }: { row: { original: SalesReportRow } }) => <span className="whitespace-nowrap">{dateTime(row.original.date)}</span> },
  { id: "sucursal", header: "Sucursal", cell: ({ row }: { row: { original: SalesReportRow } }) => row.original.locationName },
  { id: "cajero", header: "Cajero", cell: ({ row }: { row: { original: SalesReportRow } }) => row.original.employeeName ?? "—" },
  { id: "cliente", header: "Cliente", cell: ({ row }: { row: { original: SalesReportRow } }) => row.original.customerName ?? <span className="text-muted-foreground">Mostrador</span> },
  { id: "items", header: "Art.", cell: ({ row }: { row: { original: SalesReportRow } }) => <span className="tabular-nums">{row.original.itemCount}</span> },
  { id: "total", header: "Total", cell: ({ row }: { row: { original: SalesReportRow } }) => <span className="font-semibold tabular-nums">{fmt.money(row.original.total)}</span> },
];

// ── Cortes de caja ──────────────────────────────────────────────────────

function CashTab({ filters }: { filters: () => ApiFilters }) {
  const load = useCallback(() => reportsApi.cash(filters()), [filters]);
  const { data, loading, reload } = useGeneral(load);
  if (!data) return <ReportSkeleton />;
  const t = data.totals;
  const closed = data.rows.filter((r) => r.difference != null);
  const withDiff = closed.filter((r) => Math.abs(r.difference ?? 0) >= 1);
  const netDiff = closed.reduce((s, r) => s + (r.difference ?? 0), 0);
  const open = data.rows.filter((r) => r.status === "open").length;

  return (
    <div className={cn("space-y-4 transition-opacity", loading && "opacity-60")}>
      <KpiGrid cols={4}>
        <Kpi label="Ventas en turnos" value={fmt.money(t.totalSales)} icon={TrendingUp} tone="primary" emphasis hint={`${fmt.int(data.rows.length)} turnos`} />
        <Kpi label="Efectivo esperado" value={fmt.money(t.expectedCash)} icon={Banknote} hint={`Cobrado ${fmt.money(t.cashPayments)}`} />
        <Kpi label="Turnos con diferencia" value={`${withDiff.length} / ${closed.length}`} icon={Scale} tone={withDiff.length ? "warning" : "success"} />
        <Kpi label="Diferencia neta" value={fmt.money(netDiff)} tone={Math.abs(netDiff) < 1 ? "success" : netDiff < 0 ? "danger" : "info"} hint={open ? `${open} caja(s) abierta(s)` : "todas cerradas"} />
      </KpiGrid>

      {closed.length > 0 && (
        <ReportPanel title="Diferencias por corte" description="Efectivo contado menos esperado en los últimos cierres. Negativo = faltante.">
          <SeriesChart
            data={[...closed].reverse().slice(-20).map((r) => ({ name: `${r.registerName ?? r.locationName} · ${dateTime(r.closedAt)}`, difference: r.difference ?? 0 }))}
            xKey="name"
            xFormat={(v) => v.split(" · ")[1] ?? v}
            height={220}
            series={[{ key: "difference", label: "Diferencia", kind: "bar", color: "var(--warning)" }]}
          />
        </ReportPanel>
      )}

      <DataTable
        columns={cashColumns}
        data={data.rows}
        searchable={false}
        showColumnVisibility={false}
        pageSize={20}
        loading={loading}
        emptyMessage="Sin cortes de caja para los filtros"
        rowKey={(r) => r.id}
        onRefresh={reload}
        refreshing={loading}
      />
    </div>
  );
}

const cashColumns = [
  {
    id: "caja",
    header: "Caja",
    cell: ({ row }: { row: { original: CashReportRow } }) => (
      <EntityCell title={row.original.registerName ?? "Caja"} subtitle={`${row.original.locationName}${row.original.employeeName ? ` · ${row.original.employeeName}` : ""}`} />
    ),
  },
  { id: "apertura", header: "Apertura", cell: ({ row }: { row: { original: CashReportRow } }) => <span className="whitespace-nowrap">{dateTime(row.original.openedAt)}</span> },
  { id: "estado", header: "Estado", cell: ({ row }: { row: { original: CashReportRow } }) => (row.original.status === "open" ? <StatusPill tone="success">Abierta</StatusPill> : <StatusPill tone="neutral">Cerrada</StatusPill>) },
  { id: "ventas", header: "Ventas", cell: ({ row }: { row: { original: CashReportRow } }) => <span className="font-semibold tabular-nums">{fmt.money(row.original.totalSales)}</span> },
  { id: "esperado", header: "Esperado", cell: ({ row }: { row: { original: CashReportRow } }) => <span className="tabular-nums">{fmt.money(row.original.expectedCash)}</span> },
  { id: "contado", header: "Contado", cell: ({ row }: { row: { original: CashReportRow } }) => <span className="tabular-nums">{row.original.closingCash == null ? "—" : fmt.money(row.original.closingCash)}</span> },
  {
    id: "diferencia",
    header: "Diferencia",
    cell: ({ row }: { row: { original: CashReportRow } }) => {
      const d = row.original.difference;
      if (d == null) return <span className="text-muted-foreground">—</span>;
      if (Math.abs(d) < 1) return <StatusPill tone="success">Cuadra</StatusPill>;
      return <StatusPill tone={d < 0 ? "danger" : "info"}>{d < 0 ? "Faltan " : "Sobran "}{fmt.money(Math.abs(d))}</StatusPill>;
    },
  },
];

// ── Pedidos ─────────────────────────────────────────────────────────────

function OrdersTab({ filters }: { filters: () => ApiFilters }) {
  const load = useCallback(() => reportsApi.orders(filters()), [filters]);
  const { data, loading, reload } = useGeneral(load);
  if (!data) return <ReportSkeleton />;
  const t = data.totals;
  const count = data.rows.length;
  const valid = count - t.cancelled;

  return (
    <div className={cn("space-y-4 transition-opacity", loading && "opacity-60")}>
      <KpiGrid cols={4}>
        <Kpi label="Pedidos" value={fmt.int(count)} icon={ClipboardList} tone="primary" emphasis hint={`${fmt.int(t.delivered)} entregados`} />
        <Kpi label="Importe (sin cancelados)" value={fmt.money(t.total)} icon={Wallet} hint={valid ? `Ticket ${fmt.money(t.total / valid)}` : undefined} />
        <Kpi label="A domicilio · Recoger" value={`${fmt.int(t.delivery)} · ${fmt.int(t.pickup)}`} icon={Truck} />
        <Kpi label="Cancelados" value={fmt.int(t.cancelled)} icon={XCircle} tone={t.cancelled ? "danger" : "success"} hint={count ? fmt.pct((t.cancelled / count) * 100, 0) : undefined} />
      </KpiGrid>

      <ReportPanel title="Pedidos por estado" icon={PackageCheck}>
        <BarList
          items={[...data.byStatus]
            .sort((a, b) => b.count - a.count)
            .map((s) => {
              const tone = ORDER_STATUS_TONE[s.status as OrderStatusKey] ?? "neutral";
              return {
                label: ORDER_STATUS_LABELS[s.status as OrderStatusKey] ?? s.status,
                value: s.count,
                display: fmt.int(s.count),
                tone: tone === "neutral" ? "default" : tone,
              };
            })}
          empty="Sin pedidos"
        />
      </ReportPanel>

      <DataTable
        columns={ordersColumns}
        data={data.rows}
        searchable={false}
        showColumnVisibility={false}
        pageSize={20}
        loading={loading}
        emptyMessage="Sin pedidos para los filtros"
        rowKey={(r) => r.id}
        onRefresh={reload}
        refreshing={loading}
      />
    </div>
  );
}

const ordersColumns = [
  { id: "pedido", header: "Pedido", cell: ({ row }: { row: { original: OrdersReportRow } }) => <span className="font-semibold tabular-nums">#{row.original.orderNumber}</span> },
  { id: "fecha", header: "Fecha", cell: ({ row }: { row: { original: OrdersReportRow } }) => <span className="whitespace-nowrap">{dateTime(row.original.createdAt)}</span> },
  { id: "cliente", header: "Cliente", cell: ({ row }: { row: { original: OrdersReportRow } }) => row.original.customerName ?? "—" },
  { id: "entrega", header: "Entrega", cell: ({ row }: { row: { original: OrdersReportRow } }) => (row.original.deliveryMethod === "delivery" ? "A domicilio" : "Recoger") },
  { id: "estado", header: "Estado", cell: ({ row }: { row: { original: OrdersReportRow } }) => <OrderStatusPill status={row.original.status} /> },
  { id: "total", header: "Total", cell: ({ row }: { row: { original: OrdersReportRow } }) => <span className="font-semibold tabular-nums">{fmt.money(row.original.total)}</span> },
];

// ── Clientes ────────────────────────────────────────────────────────────

function CustomersTab({ filters }: { filters: () => ApiFilters }) {
  const load = useCallback(() => reportsApi.customers(filters()), [filters]);
  const { data, loading, reload } = useGeneral(load);
  if (!data) return <ReportSkeleton />;
  const t = data.totals;

  return (
    <div className={cn("space-y-4 transition-opacity", loading && "opacity-60")}>
      <KpiGrid cols={4}>
        <Kpi label="Clientes que compraron" value={fmt.int(t.customers)} icon={Users} tone="primary" emphasis />
        <Kpi label="Gasto total" value={fmt.money(t.totalSpent)} icon={Wallet} hint={`${fmt.int(t.purchases)} compras`} />
        <Kpi label="Gasto por cliente" value={fmt.money(t.avgSpent)} icon={UserRound} />
        <Kpi label="Recurrentes" value={fmt.pct(t.customers ? (t.repeatCustomers / t.customers) * 100 : 0, 0)} icon={RotateCcw} tone="success" hint={`${fmt.int(t.repeatCustomers)} con 2+ compras`} />
      </KpiGrid>

      <ReportPanel title="Top 10 clientes" description="Por gasto en el periodo">
        <BarList
          items={data.rows.slice(0, 10).map((r) => ({
            label: r.fullName,
            value: r.totalSpent,
            display: fmt.money(r.totalSpent),
            secondary: `${fmt.int(r.salesCount)} compras · ${fmt.int(r.points)} puntos`,
          }))}
          empty="Sin clientes con compras en el periodo"
        />
      </ReportPanel>

      <DataTable
        columns={customersColumns}
        data={data.rows}
        searchable={false}
        showColumnVisibility={false}
        pageSize={20}
        loading={loading}
        emptyMessage="Sin clientes para los filtros"
        rowKey={(r) => r.id}
        onRefresh={reload}
        refreshing={loading}
      />
    </div>
  );
}

const customersColumns = [
  { id: "cliente", header: "Cliente", cell: ({ row }: { row: { original: CustomersReportRow } }) => <EntityCell title={row.original.fullName} subtitle={row.original.phone ?? row.original.customerCode ?? undefined} /> },
  { id: "compras", header: "Compras", cell: ({ row }: { row: { original: CustomersReportRow } }) => <span className="tabular-nums">{row.original.salesCount}</span> },
  { id: "puntos", header: "Puntos", cell: ({ row }: { row: { original: CustomersReportRow } }) => <span className="tabular-nums">{fmt.int(row.original.points)}</span> },
  { id: "ultima", header: "Última compra", cell: ({ row }: { row: { original: CustomersReportRow } }) => <span className="whitespace-nowrap">{dateTime(row.original.lastPurchaseAt)}</span> },
  { id: "total", header: "Gasto", cell: ({ row }: { row: { original: CustomersReportRow } }) => <span className="font-semibold tabular-nums">{fmt.money(row.original.totalSpent)}</span> },
];

// ── Crédito ─────────────────────────────────────────────────────────────

function CreditTab() {
  const load = useCallback(() => reportsApi.credit({}), []);
  const { data, loading, reload } = useGeneral(load);
  const [sending, setSending] = useState(false);
  if (!data) return <ReportSkeleton />;
  const t = data.totals;

  const sendReminders = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/credit/reminder", { method: "POST", credentials: "include" });
      const body = await res.json();
      if (body.ok) toast.success(body.message);
      else toast.error(body.error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={cn("space-y-4 transition-opacity", loading && "opacity-60")}>
      <KpiGrid cols={4}>
        <Kpi label="Cartera total" value={fmt.money(t.totalDebt)} icon={Landmark} tone="primary" emphasis hint={`${fmt.int(data.rows.length)} clientes`} />
        <Kpi label="Vencido" value={fmt.money(t.totalOverdue)} tone={t.totalOverdue > 0 ? "danger" : "success"} hint={`${fmt.int(t.overdueCount)} clientes`} />
        <Kpi label="Cobrado" value={fmt.money(t.totalPayments)} icon={Banknote} tone="success" />
        <Kpi label="Uso del límite" value={fmt.pct(t.totalCreditLimit ? (t.totalDebt / t.totalCreditLimit) * 100 : 0, 0)} hint={`Límite ${fmt.money(t.totalCreditLimit)}`} />
      </KpiGrid>

      <ReportPanel
        title="Saldos por cliente"
        description="Los 10 saldos más altos"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={sendReminders} disabled={sending || t.overdueCount === 0}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />} Enviar recordatorios
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/reports/bi?reporte=credit_aging">
                Antigüedad de cartera <ArrowRight className="size-4" />
              </Link>
            </Button>
          </>
        }
      >
        <BarList
          items={data.rows.slice(0, 10).map((r) => ({
            label: r.customerName,
            value: r.currentBalance,
            display: fmt.money(r.currentBalance),
            secondary: r.isOverdue ? `Vencido hace ${r.daysOverdue} días` : r.oldestDueDate ? `Vence ${new Date(r.oldestDueDate).toLocaleDateString("es-MX")}` : undefined,
            tone: r.isOverdue ? "danger" : "warning",
          }))}
          empty="Ningún cliente tiene saldo pendiente"
        />
      </ReportPanel>

      {data.rows.length > 0 && <DataTable
        columns={creditColumns}
        data={data.rows}
        searchable={false}
        showColumnVisibility={false}
        pageSize={20}
        loading={loading}
        emptyMessage="Sin clientes con deuda"
        rowKey={(r) => r.id}
        onRefresh={reload}
        refreshing={loading}
      />}
    </div>
  );
}

const creditColumns = [
  { id: "cliente", header: "Cliente", cell: ({ row }: { row: { original: CreditReportRow } }) => <EntityCell title={row.original.customerName} subtitle={row.original.customerPhone ?? row.original.customerCode ?? undefined} /> },
  { id: "limite", header: "Límite", cell: ({ row }: { row: { original: CreditReportRow } }) => <span className="tabular-nums">{row.original.creditLimit != null ? fmt.money(row.original.creditLimit) : <span className="text-muted-foreground">Sin límite</span>}</span> },
  { id: "deuda", header: "Saldo", cell: ({ row }: { row: { original: CreditReportRow } }) => <span className="font-semibold tabular-nums">{fmt.money(row.original.currentBalance)}</span> },
  { id: "cobrado", header: "Cobrado", cell: ({ row }: { row: { original: CreditReportRow } }) => <span className="tabular-nums text-success-ink">{fmt.money(row.original.totalPayments)}</span> },
  {
    id: "vencimiento",
    header: "Vencimiento",
    cell: ({ row }: { row: { original: CreditReportRow } }) =>
      row.original.isOverdue ? (
        <StatusPill tone="danger">Vencido {row.original.daysOverdue} d</StatusPill>
      ) : row.original.oldestDueDate ? (
        <StatusPill tone="neutral">{new Date(row.original.oldestDueDate).toLocaleDateString("es-MX")}</StatusPill>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    id: "estado",
    header: "Cuenta",
    cell: ({ row }: { row: { original: CreditReportRow } }) => (
      <CreditStatusPill status={row.original.status} />
    ),
  },
];
