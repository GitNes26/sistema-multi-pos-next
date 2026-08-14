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
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/base/data-table";
import {
  crudApi,
  reportsApi,
  type SalesReportRow,
  type CashReportRow,
  type OrdersReportRow,
  type CustomersReportRow,
  type ReportFilters,
  type ReportType,
} from "@/lib/api";
import { swalError, swalToast } from "@/lib/swal";
import { money } from "@/lib/pos/money";
import { cn } from "@/lib/utils";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";

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

type ReportTab = "sales" | "cash" | "orders" | "customers" | "inventory";

const TABS: { value: ReportTab; label: string; icon: React.ReactNode }[] = [
  { value: "sales", label: "Ventas", icon: <ReceiptText className="size-4" /> },
  { value: "cash", label: "Corte de caja", icon: <Boxes className="size-4" /> },
  { value: "orders", label: "Pedidos", icon: <ClipboardList className="size-4" /> },
  { value: "customers", label: "Clientes", icon: <Users className="size-4" /> },
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

export function ReportsPage({ canView, canExport, icon }: ReportsPageProps) {
  const [tab, setTab] = useState<ReportTab>("sales");
  const [filters, setFilters] = useState<ReportsFilters>(EMPTY_FILTERS);
  const [options, setOptions] = useState<{ locations: FilterOption[]; employees: FilterOption[]; registers: FilterOption[] }>({
    locations: [],
    employees: [],
    registers: [],
  });
  const [busy, setBusy] = useState<{ tab: ReportTab; format: "xlsx" | "pdf" } | null>(null);

  // ── Datos por tab ──
  const [sales, setSales] = useState<SalesReportRow[]>([]);
  const [salesTotals, setSalesTotals] = useState({ subtotal: 0, discount: 0, tax: 0, total: 0, pointsEarned: 0 });
  const [cash, setCash] = useState<CashReportRow[]>([]);
  const [cashTotals, setCashTotals] = useState({ totalSales: 0, salesCount: 0, cashPayments: 0, expectedCash: 0 });
  const [orders, setOrders] = useState<OrdersReportRow[]>([]);
  const [ordersTotals, setOrdersTotals] = useState({ total: 0, delivery: 0, pickup: 0 });
  const [ordersByStatus, setOrdersByStatus] = useState<{ status: string; count: number }[]>([]);
  const [customers, setCustomers] = useState<CustomersReportRow[]>([]);
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
  const chip = (active: boolean) => (active ? "bg-primary text-primary-foreground" : "");

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
              <Input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                className="h-8 w-40"
                aria-label="Desde"
              />
              <Input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                className="h-8 w-40"
                aria-label="Hasta"
              />
              <Select value={filters.locationId} onValueChange={(v) => setFilters((f) => ({ ...f, locationId: v }))}>
                <SelectTrigger className={cn("h-8 w-44 text-xs", chip(!!filters.locationId))}>
                  <SelectValue placeholder="Sucursal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todas las sucursales</SelectItem>
                  {options.locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.employeeId} onValueChange={(v) => setFilters((f) => ({ ...f, employeeId: v }))}>
                <SelectTrigger className={cn("h-8 w-44 text-xs", chip(!!filters.employeeId))}>
                  <SelectValue placeholder="Empleado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todos los empleados</SelectItem>
                  {options.employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.cashRegisterId} onValueChange={(v) => setFilters((f) => ({ ...f, cashRegisterId: v }))}>
                <SelectTrigger className={cn("h-8 w-44 text-xs", chip(!!filters.cashRegisterId))}>
                  <SelectValue placeholder="Caja" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todas las cajas</SelectItem>
                  {options.registers.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  <CardContent className="h-48">
                    <PieChart>
                      <Pie
                        data={ordersByStatus.map((s) => ({ name: statusLabel(s.status), value: s.count }))}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                      >
                        {ordersByStatus.map((s, i) => (
                          <Cell key={i} fill={STATUS_COLORS[s.status] ?? "#94a3b8"} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
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

            <TabsContent value="customers" className="mt-4 space-y-4">
              <BarChart data={topCustomersChartData(customers)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: unknown) => money(Number(v ?? 0))} />
                <Bar dataKey="totalSpent" name="Total" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
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