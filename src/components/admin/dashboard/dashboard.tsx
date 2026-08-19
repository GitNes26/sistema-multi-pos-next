"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Banknote,
  ShoppingCart,
  TrendingUp,
  Users,
  Package,
  Trophy,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { reportsApi, type DashboardData } from "@/lib/api";
import { swalError } from "@/lib/swal";
import { money } from "@/lib/pos/money";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// FASE 10.1/10.4 — Dashboard con métricas reales y gráficas (Recharts).

const PAYMENT_COLORS: Record<string, string> = {
  cash: "#10b981",
  card: "#6366f1",
  wallet: "#f59e0b",
  points: "#8b5cf6",
  other: "#64748b",
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  wallet: "Monedero",
  points: "Puntos",
  other: "Otro",
};

function MetricCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

export function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await reportsApi.dashboard();
      setData(d);
    } catch (err) {
      swalError("No se pudo cargar el panel", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="pt-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Ventas de hoy"
          value={money(data.today.sales)}
          hint={`${data.today.count} ticket(s)`}
          icon={<ShoppingCart className="size-4" />}
        />
        <MetricCard
          label="Ticket promedio"
          value={money(data.today.avgTicket)}
          hint="Solo ventas de hoy"
          icon={<TrendingUp className="size-4" />}
        />
        <MetricCard
          label="Clientes"
          value={String(data.customers)}
          hint="Registrados en tu organización"
          icon={<Users className="size-4" />}
        />
        <MetricCard
          label={`Ventas · ${data.period.from} → ${data.period.to}`}
          value={money(data.period.sales)}
          hint={`${data.period.count} ventas · margen ${data.period.marginPct}%`}
          icon={<Banknote className="size-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas por día</CardTitle>
            <CardDescription>Últimos 30 días</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.period.byDay}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))} />
                <Tooltip formatter={(v: unknown) => money(Number(v ?? 0))} />
                <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas por método de pago</CardTitle>
            <CardDescription>Últimos 30 días</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.period.byPayment.map((p) => ({
                    name: PAYMENT_LABELS[p.method] ?? p.method,
                    value: p.amount,
                  }))}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {data.period.byPayment.map((p, i) => (
                    <Cell key={i} fill={PAYMENT_COLORS[p.method] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: unknown) => money(Number(v ?? 0))} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="size-4" /> Top productos
            </CardTitle>
            <CardDescription>Por ingresos (últimos 30 días)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.period.topProducts.length === 0 && (
              <p className="text-sm text-muted-foreground">Aún no hay ventas registradas.</p>
            )}
            {data.period.topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="truncate text-sm font-medium">{p.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {p.sharePct}%
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-sm">
                  <span className="text-xs text-muted-foreground">×{p.quantity}</span>
                  <span className="font-semibold tabular-nums">{money(p.total)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4" /> Resumen del período
            </CardTitle>
            <CardDescription>Margen bruto estimado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Ventas totales</p>
                <p className="text-xl font-bold tabular-nums">{money(data.period.sales)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Margen bruto</p>
                <p className="text-xl font-bold tabular-nums">{money(data.period.margin)}</p>
                <p className="text-xs text-muted-foreground">{data.period.marginPct}% sobre ventas</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Nº de ventas</p>
                <p className="text-xl font-bold tabular-nums">{data.period.count}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Período</p>
                <p className="text-sm font-semibold">
                  {data.period.from} → {data.period.to}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}