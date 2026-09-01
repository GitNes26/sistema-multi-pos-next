"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FileDown,
  FileSpreadsheet,
  Loader2,
  ReceiptText,
  Users,
  ClipboardList,
  Boxes,
  Landmark,
  Bell,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/base/data-table";
import { FormCombobox } from "@/components/base/form-combobox";
import { DatePicker } from "@/components/base/date-picker";
import { CrudCreateDialog } from "@/components/admin/crud/crud-create-dialog";
import {
  crudApi,
  reportsApi,
  type SalesReportRow,
  type CashReportRow,
  type OrdersReportRow,
  type CustomersReportRow,
  type CreditReportRow,
  type ReportFilters,
  type ReportType,
} from "@/lib/api";
import { swalError, swalToast } from "@/lib/swal";
import { money } from "@/lib/pos/money";
import { cn } from "@/lib/utils";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// FASE 10.2/10.3/10.6/10.7/10.8 — Reportes con filtros avanzados y exportación.

interface FilterOption {
  id: string;
  name: string;
}

interface ReportsPageProps {
  canView: boolean;
  canExport: boolean;
  icon?: React.ReactNode;
}

type ReportTab = "sales" | "cash" | "orders" | "customers" | "credit" | "inventory";

const TABS: { value: ReportTab; label: string; icon: React.ReactNode }[] = [
  { value: "sales", label: "Ventas", icon: <ReceiptText className="size-4" /> },
  { value: "cash", label: "Corte de caja", icon: <Boxes className="size-4" /> },
  { value: "orders", label: "Pedidos", icon: <ClipboardList className="size-4" /> },
  { value: "customers", label: "Clientes", icon: <Users className="size-4" /> },
  { value: "credit", label: "Crédito", icon: <Landmark className="size-4" /> },
  { value: "inventory", label: "Inventario", icon: <Boxes className="size-4" /> },
];

interface ReportsFilters {
  from: string;
  to: string;
  locationId: string;
  employeeId: string;
  cashRegisterId: string;
  status: string;
}

const EMPTY_FILTERS: ReportsFilters = { from: "", to: "", locationId: "", employeeId: "", cashRegisterId: "", status: "" };

function isoToLocalDate(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ReportsPage({ canView, canExport, icon }: ReportsPageProps) {
  const [tab, setTab] = useState<ReportTab>("sales");
  const [filters, setFilters] = useState<ReportsFilters>(EMPTY_FILTERS);
  const [options, setOptions] = useState<{ locations: FilterOption[]; employees: FilterOption[]; registers: FilterOption[] }>({
    locations: [],
    employees: [],
    registers: [],
  });
  const [busy, setBusy] = useState<{ tab: ReportTab; format: "xlsx" | "pdf" } | null>(null);
  const [createModule, setCreateModule] = useState<string | null>(null);

  // ── Datos por tab ──
  const [sales, setSales] = useState<SalesReportRow[]>([]);
  const [salesTotals, setSalesTotals] = useState({ subtotal: 0, discount: 0, tax: 0, total: 0, pointsEarned: 0 });
  const [cash, setCash] = useState<CashReportRow[]>([]);
  const [cashTotals, setCashTotals] = useState({ totalSales: 0, salesCount: 0, cashPayments: 0, expectedCash: 0 });
  const [orders, setOrders] = useState<OrdersReportRow[]>([]);
  const [ordersTotals, setOrdersTotals] = useState({ total: 0, delivery: 0, pickup: 0 });
  const [ordersByStatus, setOrdersByStatus] = useState<{ status: string; count: number }[]>([]);
  const [customers, setCustomers] = useState<CustomersReportRow[]>([]);
  const [credit, setCredit] = useState<CreditReportRow[]>([]);
  const [creditTotals, setCreditTotals] = useState({ totalDebt: 0, totalCharges: 0, totalPayments: 0, totalOverdue: 0, totalCreditLimit: 0, overdueCount: 0, activeCount: 0 });
  const [loading, setLoading] = useState(false);

  const filterParams = useCallback((): ReportFilters => {
    const params: ReportFilters = {};
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    if (filters.locationId) params.locationId = filters.locationId;
    if (filters.employeeId) params.employeeId = filters.employeeId;
    if (filters.cashRegisterId) params.cashRegisterId = filters.cashRegisterId;
    if (filters.status) params.status = filters.status;
    return params;
  }, [filters]);

  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const params = filterParams();
      if (tab === "sales") {
        const r = await reportsApi.sales(params);
        setSales(r.rows);
        setSalesTotals(r.totals);
      } else if (tab === "cash") {
        const r = await reportsApi.cash(params);
        setCash(r.rows);
        setCashTotals(r.totals);
      } else if (tab === "orders") {
        const r = await reportsApi.orders(params);
        setOrders(r.rows);
        setOrdersTotals(r.totals);
        setOrdersByStatus(r.byStatus);
      } else if (tab === "customers") {
        const r = await reportsApi.customers(params);
        setCustomers(r.rows);
      } else if (tab === "credit") {
        const r = await reportsApi.credit(params);
        setCredit(r.rows);
        setCreditTotals(r.totals);
      }
    } catch (err) {
      swalError("No se pudo cargar el reporte", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [canView, tab, filterParams]);

  useEffect(() => {
    load();
  }, [load]);

  const loadOptions = useCallback(async () => {
    try {
      const [locations, employees, registers] = await Promise.all([
        crudApi.list("locations", { pageSize: 250 }).then((r) => r.rows.map((x) => ({ id: String(x.id), name: String(x.name) }))),
        crudApi.list("employees", { pageSize: 250 }).then((r) => r.rows.map((x) => ({ id: String(x.id), name: String(x.fullName ?? "") }))),
        crudApi.list("cashRegisters", { pageSize: 250 }).then((r) => r.rows.map((x) => ({ id: String(x.id), name: String(x.name) }))),
      ]);
      setOptions({ locations, employees, registers });
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => {
    if (canView) loadOptions();
  }, [canView, loadOptions]);

  const handleExport = async (format: "xlsx" | "pdf") => {
    if (!canExport) {
      swalError("Sin permiso", "No tienes permiso para exportar reportes.");
      return;
    }
    if (tab === "inventory") {
      swalError("Usa Inventario", "El reporte de inventario se exporta desde la sección Inventario.");
      return;
    }
    setBusy({ tab, format });
    try {
      await reportsApi.export(tab as ReportType, format, filterParams());
      swalToast("Reporte exportado");
    } catch (err) {
      swalError("No se pudo exportar", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const hasActiveFilters = filters.from || filters.to || filters.locationId || filters.employeeId || filters.cashRegisterId || filters.status;

  if (!canView) {
  return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No tienes permiso para ver los reportes.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        icon={icon}
        title="Reportes"
        description="Analítica con filtros avanzados y exportación."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport("xlsx")} disabled={busy !== null}>
              {busy?.format === "xlsx" ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={busy !== null}>
              {busy?.format === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
              PDF
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="space-y-3 pt-5">
          <Tabs value={tab} onValueChange={(v) => setTab(v as ReportTab)}>
            <TabsList className="flex-wrap">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  <span className="flex items-center gap-1.5">{t.icon}{t.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <DatePicker
                value={isoToLocalDate(filters.from)}
                onChange={(d) => setFilters((f) => ({ ...f, from: d ? toISODate(d) : "" }))}
                onClear={() => setFilters((f) => ({ ...f, from: "" }))}
                placeholder="Desde"
                className="w-44"
              />
              <DatePicker
                value={isoToLocalDate(filters.to)}
                onChange={(d) => setFilters((f) => ({ ...f, to: d ? toISODate(d) : "" }))}
                onClear={() => setFilters((f) => ({ ...f, to: "" }))}
                placeholder="Hasta"
                className="w-44"
              />
              <FormCombobox
                options={options.locations.map((l) => ({ value: l.id, label: l.name }))}
                value={filters.locationId || null}
                onChange={(v) => setFilters((f) => ({ ...f, locationId: v }))}
                onClear={() => setFilters((f) => ({ ...f, locationId: "" }))}
                onSync={loadOptions}
                onCreate={() => setCreateModule("locations")}
                placeholder="Todas las sucursales"
                className="w-44"
              />
              <FormCombobox
                options={options.employees.map((e) => ({ value: e.id, label: e.name }))}
                value={filters.employeeId || null}
                onChange={(v) => setFilters((f) => ({ ...f, employeeId: v }))}
                onClear={() => setFilters((f) => ({ ...f, employeeId: "" }))}
                onSync={loadOptions}
                onCreate={() => setCreateModule("employees")}
                placeholder="Todos los empleados"
                className="w-44"
              />
              <FormCombobox
                options={options.registers.map((r) => ({ value: r.id, label: r.name }))}
                value={filters.cashRegisterId || null}
                onChange={(v) => setFilters((f) => ({ ...f, cashRegisterId: v }))}
                onClear={() => setFilters((f) => ({ ...f, cashRegisterId: "" }))}
                onSync={loadOptions}
                onCreate={() => setCreateModule("cashRegisters")}
                placeholder="Todas las cajas"
                className="w-44"
              />
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-8" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Limpiar
                </Button>
              )}
            </div>

            <TabsContent value="sales" className="mt-4 space-y-4">
              <SummaryCards
                items={[
                  { label: "Total ventas", value: money(salesTotals.total), accent: true },
                  { label: "Nº de ventas", value: String(sales.length) },
                  { label: "Subtotal", value: money(salesTotals.subtotal) },
                  { label: "Descuentos", value: money(salesTotals.discount) },
                  { label: "Impuestos", value: money(salesTotals.tax) },
                  { label: "Puntos ganados", value: String(Math.round(salesTotals.pointsEarned)) },
                ]}
              />
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ventas por día</CardTitle>
                  <CardDescription>Total vendido por fecha</CardDescription>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesTrendData(sales)} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => money(Number(v))} />
                      <Tooltip formatter={(v) => money(Number(v ?? 0))} />
                      <Area type="monotone" dataKey="total" name="Ventas" stroke="#6366f1" strokeWidth={2} fill="url(#salesFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <DataTable
                columns={salesColumns}
                data={sales}
                searchable={false}
                showColumnVisibility={false}
                showPagination={true}
                pageSize={20}
                loading={loading}
                emptyMessage="Sin ventas para los filtros"
                rowKey={(r) => r.id}
              />
            </TabsContent>

            <TabsContent value="cash" className="mt-4 space-y-4">
              <SummaryCards
                items={[
                  { label: "Ventas en sesiones", value: money(cashTotals.totalSales), accent: true },
                  { label: "Sesiones", value: String(cashTotals.salesCount) },
                  { label: "Efectivo registrado", value: money(cashTotals.cashPayments) },
                  { label: "Esperado total", value: money(cashTotals.expectedCash) },
                ]}
              />
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ventas por caja</CardTitle>
                  <CardDescription>Total por sesión de caja</CardDescription>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cashChartData(cash)} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => money(Number(v))} />
                      <Tooltip formatter={(v) => money(Number(v ?? 0))} />
                      <Bar dataKey="totalSales" name="Ventas" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <DataTable
                columns={cashColumns}
                data={cash}
                searchable={false}
                showColumnVisibility={false}
                showPagination={true}
                pageSize={20}
                loading={loading}
                emptyMessage="Sin cortes de caja para los filtros"
                rowKey={(r) => r.id}
              />
            </TabsContent>

            <TabsContent value="orders" className="mt-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <SummaryCards
                  items={[
                    { label: "Total pedidos", value: String(orders.length), accent: true },
                    { label: "Importe", value: money(ordersTotals.total) },
                    { label: "A domicilio", value: String(ordersTotals.delivery) },
                    { label: "Para recoger", value: String(ordersTotals.pickup) },
                  ]}
                />
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Pedidos por estado</CardTitle>
                    <CardDescription>Distribución actual</CardDescription>
                  </CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={ordersByStatus.map((s) => ({ name: statusLabel(s.status), value: s.count }))}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={80}
                          paddingAngle={2}
                        >
                          {ordersByStatus.map((s, i) => (
                            <Cell key={i} fill={STATUS_COLORS[s.status] ?? "#94a3b8"} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
              <DataTable
                columns={ordersColumns}
                data={orders}
                searchable={false}
                showColumnVisibility={false}
                showPagination={true}
                pageSize={20}
                loading={loading}
                emptyMessage="Sin pedidos para los filtros"
                rowKey={(r) => r.id}
              />
            </TabsContent>

            <TabsContent value="credit" className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <SummaryCards
                  items={[
                    { label: "Cartera total", value: money(creditTotals.totalDebt), accent: true },
                    { label: "Clientes con deuda", value: String(credit.length) },
                    { label: "Vencidos", value: String(creditTotals.overdueCount), },
                    { label: "Total cobrado", value: money(creditTotals.totalPayments) },
                  ]}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const res = await fetch("/api/credit/reminder", { method: "POST", credentials: "include" });
                    const data = await res.json();
                    if (data.ok) toast.success(data.message);
                    else toast.error(data.error);
                  }}
                >
                  <Bell className="size-4" /> Enviar recordatorios
                </Button>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cartera de crédito</CardTitle>
                  <CardDescription>Clientes con saldo pendiente y estado de vencimiento</CardDescription>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={creditChartData(credit)} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => money(Number(v))} />
                      <Tooltip formatter={(v: unknown) => money(Number(v ?? 0))} />
                      <Bar dataKey="balance" name="Deuda" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <DataTable
                columns={creditColumns}
                data={credit}
                searchable={false}
                showColumnVisibility={false}
                showPagination={true}
                pageSize={20}
                loading={loading}
                emptyMessage="Sin clientes con deuda"
                rowKey={(r) => r.id}
              />
            </TabsContent>

            <TabsContent value="customers" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Clientes con más compras</CardTitle>
                  <CardDescription>Top 10 por total gastado</CardDescription>
                </CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topCustomersChartData(customers)} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => money(Number(v))} />
                      <Tooltip formatter={(v: unknown) => money(Number(v ?? 0))} />
                      <Bar dataKey="totalSpent" name="Total" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <DataTable
                columns={customersColumns}
                data={customers}
                searchable={false}
                showColumnVisibility={false}
                showPagination={true}
                pageSize={20}
                loading={loading}
                emptyMessage="Sin clientes para los filtros"
                rowKey={(r) => r.id}
              />
            </TabsContent>

            <TabsContent value="inventory" className="mt-4 space-y-4">
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  El reporte de inventario en PDF se exporta desde la sección{" "}
                  <Link
                    href="/admin/inventory"
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    Inventario
                  </Link>
                  {" "}(botón PDF, FASE 8.7).
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {createModule && (
        <CrudCreateDialog
          module={createModule}
          onClose={() => setCreateModule(null)}
          onCreated={async (record) => {
            const targetModule = createModule;
            setCreateModule(null);
            await loadOptions();
            const id = String(record.id ?? "");
            if (id) {
              const key = targetModule === "employees" ? "employeeId" : targetModule === "cashRegisters" ? "cashRegisterId" : "locationId";
              setFilters((f) => ({ ...f, [key]: id }));
            }
          }}
        />
      )}
    </>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  confirmed: "#0ea5e9",
  preparing: "#f97316",
  ready: "#10b981",
  delivered: "#2563eb",
  cancelled: "#ef4444",
};

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    pending: "Pendiente",
    confirmed: "Confirmado",
    preparing: "Preparando",
    ready: "Listo",
    delivered: "Entregado",
    cancelled: "Cancelado",
  };
  return map[s] ?? s;
}

function SummaryCards({ items }: { items: { label: string; value: string; accent?: boolean }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className={cn("rounded-lg border p-3", it.accent && "border-primary/40 bg-primary/5")}>
          <p className="text-xs text-muted-foreground">{it.label}</p>
          <p className="text-lg font-bold tabular-nums">{it.value}</p>
        </div>
      ))}
    </div>
  );
}

function topCustomersChartData(rows: CustomersReportRow[]) {
  return rows.slice(0, 10).map((r) => ({ name: r.fullName, totalSpent: r.totalSpent }));
}

function salesTrendData(rows: SalesReportRow[]) {
  const byDay = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    const day = r.date.slice(0, 10);
    const cur = byDay.get(day) ?? { total: 0, count: 0 };
    cur.total += r.total;
    cur.count += 1;
    byDay.set(day, cur);
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, v]) => ({
      date: new Date(`${day}T00:00:00`).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }),
      total: Math.round(v.total * 100) / 100,
    }));
}

function cashChartData(rows: CashReportRow[]) {
  return rows.map((r) => ({
    name: r.registerName ?? r.locationName,
    totalSales: r.totalSales,
    expected: r.expectedCash,
  }));
}

const salesColumns = [
  { id: "folio", header: "Folio", cell: ({ row }: { row: { original: SalesReportRow } }) => <span className="font-medium tabular-nums">#{row.original.folio}</span> },
  { id: "fecha", header: "Fecha", cell: ({ row }: { row: { original: SalesReportRow } }) => new Date(row.original.date).toLocaleString("es-MX") },
  { id: "sucursal", header: "Sucursal", cell: ({ row }: { row: { original: SalesReportRow } }) => row.original.locationName },
  { id: "cajero", header: "Cajero", cell: ({ row }: { row: { original: SalesReportRow } }) => row.original.employeeName ?? row.original.customerName ?? "—" },
  { id: "cliente", header: "Cliente", cell: ({ row }: { row: { original: SalesReportRow } }) => row.original.customerName ?? "—" },
  { id: "items", header: "Art.", cell: ({ row }: { row: { original: SalesReportRow } }) => row.original.itemCount },
  { id: "total", header: "Total", cell: ({ row }: { row: { original: SalesReportRow } }) => <span className="font-bold tabular-nums">{money(row.original.total)}</span> },
];

const cashColumns = [
  { id: "caja", header: "Caja", cell: ({ row }: { row: { original: CashReportRow } }) => row.original.registerName ?? "—" },
  { id: "sucursal", header: "Sucursal", cell: ({ row }: { row: { original: CashReportRow } }) => row.original.locationName },
  { id: "cajero", header: "Cajero", cell: ({ row }: { row: { original: CashReportRow } }) => row.original.employeeName ?? "—" },
  { id: "apertura", header: "Apertura", cell: ({ row }: { row: { original: CashReportRow } }) => (row.original.openedAt ? new Date(row.original.openedAt).toLocaleString("es-MX") : "—") },
  { id: "estado", header: "Estado", cell: ({ row }: { row: { original: CashReportRow } }) => (row.original.status === "open" ? <Badge className="bg-emerald-500 text-white">Abierta</Badge> : <Badge variant="secondary">Cerrada</Badge>) },
  { id: "ventas", header: "Ventas", cell: ({ row }: { row: { original: CashReportRow } }) => <span className="font-bold tabular-nums">{money(row.original.totalSales)}</span> },
  { id: "esperado", header: "Esperado", cell: ({ row }: { row: { original: CashReportRow } }) => <span className="tabular-nums">{money(row.original.expectedCash)}</span> },
  {
    id: "diferencia",
    header: "Diferencia",
    cell: ({ row }: { row: { original: CashReportRow } }) => {
      const d = row.original.difference;
      if (d == null) return <span className="text-muted-foreground">—</span>;
      const positive = d >= 0;
      return <span className={cn("tabular-nums font-medium", positive ? "text-emerald-600" : "text-destructive")}>{money(d)}</span>;
    },
  },
];

const ordersColumns = [
  { id: "pedido", header: "Pedido", cell: ({ row }: { row: { original: OrdersReportRow } }) => <span className="font-medium tabular-nums">#{row.original.orderNumber}</span> },
  { id: "fecha", header: "Fecha", cell: ({ row }: { row: { original: OrdersReportRow } }) => new Date(row.original.createdAt).toLocaleString("es-MX") },
  { id: "cliente", header: "Cliente", cell: ({ row }: { row: { original: OrdersReportRow } }) => row.original.customerName ?? "—" },
  { id: "entrega", header: "Entrega", cell: ({ row }: { row: { original: OrdersReportRow } }) => (row.original.deliveryMethod === "delivery" ? "Domicilio" : "Sucursal") },
  { id: "estado", header: "Estado", cell: ({ row }: { row: { original: OrdersReportRow } }) => statusLabel(row.original.status) },
  { id: "total", header: "Total", cell: ({ row }: { row: { original: OrdersReportRow } }) => <span className="font-bold tabular-nums">{money(row.original.total)}</span> },
];

const customersColumns = [
  { id: "cliente", header: "Cliente", cell: ({ row }: { row: { original: CustomersReportRow } }) => <span className="font-medium">{row.original.fullName}</span> },
  { id: "codigo", header: "Nº", cell: ({ row }: { row: { original: CustomersReportRow } }) => row.original.customerCode ?? "—" },
  { id: "compras", header: "Compras", cell: ({ row }: { row: { original: CustomersReportRow } }) => row.original.salesCount },
  { id: "puntos", header: "Puntos", cell: ({ row }: { row: { original: CustomersReportRow } }) => Math.floor(row.original.points) },
  { id: "total", header: "Total", cell: ({ row }: { row: { original: CustomersReportRow } }) => <span className="font-bold tabular-nums">{money(row.original.totalSpent)}</span> },
  { id: "ultima", header: "Última compra", cell: ({ row }: { row: { original: CustomersReportRow } }) => (row.original.lastPurchaseAt ? new Date(row.original.lastPurchaseAt).toLocaleString("es-MX") : "—") },
];

function creditChartData(rows: CreditReportRow[]) {
  return rows.slice(0, 15).map((r) => ({
    name: r.customerName.length > 12 ? r.customerName.slice(0, 12) + "…" : r.customerName,
    balance: r.currentBalance,
  }));
}

const creditColumns = [
  { id: "cliente", header: "Cliente", cell: ({ row }: { row: { original: CreditReportRow } }) => (
    <div>
      <div className="font-medium">{row.original.customerName}</div>
      {row.original.customerPhone && <div className="text-xs text-muted-foreground">{row.original.customerPhone}</div>}
    </div>
  )},
  { id: "codigo", header: "Código", cell: ({ row }: { row: { original: CreditReportRow } }) => (
    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{row.original.customerCode ?? "—"}</code>
  )},
  { id: "limite", header: "Límite", cell: ({ row }: { row: { original: CreditReportRow } }) => (
    <span className="tabular-nums">{row.original.creditLimit != null ? money(row.original.creditLimit) : <span className="text-muted-foreground">Sin límite</span>}</span>
  )},
  { id: "deuda", header: "Deuda", cell: ({ row }: { row: { original: CreditReportRow } }) => (
    <span className="font-bold tabular-nums text-red-600">{money(row.original.currentBalance)}</span>
  )},
  { id: "cobrado", header: "Cobrado", cell: ({ row }: { row: { original: CreditReportRow } }) => (
    <span className="tabular-nums text-emerald-600">{money(row.original.totalPayments)}</span>
  )},
  { id: "vencimiento", header: "Vence", cell: ({ row }: { row: { original: CreditReportRow } }) => {
    if (row.original.isOverdue) {
      return <Badge variant="destructive">Vencido {row.original.daysOverdue}d</Badge>;
    }
    if (row.original.oldestDueDate) {
      return <Badge variant="outline">{new Date(row.original.oldestDueDate).toLocaleDateString("es-MX")}</Badge>;
    }
    return <span className="text-muted-foreground">—</span>;
  }},
  { id: "estado", header: "Estado", cell: ({ row }: { row: { original: CreditReportRow } }) => (
    <Badge variant={row.original.status === "active" ? "default" : row.original.status === "suspended" ? "destructive" : "secondary"}>
      {row.original.status === "active" ? "Activa" : row.original.status === "suspended" ? "Suspendida" : "Liquidada"}
    </Badge>
  )},
];