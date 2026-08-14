"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, PackageCheck, Radio, Search } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DataTable } from "@/components/base/data-table";
import { swalError } from "@/lib/swal";
import { money } from "@/lib/pos/money";
import { cn } from "@/lib/utils";
import {
  DELIVERY_METHOD_LABELS,
  ORDER_STATUSES,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABELS,
  ordersApi,
} from "@/lib/orders/client";
import type { OrderRow } from "@/lib/orders/server";
import { OrderDetailDialog } from "./order-detail-dialog";

// FASE 12.1 — Vista admin de pedidos: filtros, estados y acciones.

const STATUS_TABS = [
  { value: "all", label: "Todos" },
  ...ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] })),
];

export function OrdersPage({
  canManage,
  icon,
}: {
  canManage: boolean;
  icon?: React.ReactNode;
}) {
  const router = useRouter();

  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [activeOnly, setActiveOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [locationId, setLocationId] = useState("all");

  const [rows, setRows] = useState<OrderRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await ordersApi.list({
        pageSize: 100,
        status: status === "all" ? undefined : status,
        deliveryMethod: method === "all" ? undefined : method,
        locationId: locationId === "all" ? undefined : locationId,
        search: search || undefined,
        from: from || undefined,
        to: to || undefined,
        active: activeOnly || undefined,
      });
      setRows(r.rows);
      setTotal(r.total);
      setCounts(r.counts);
    } catch (err) {
      swalError("No se pudo cargar los pedidos", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [status, method, locationId, search, from, to, activeOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const loadLocations = useCallback(async () => {
    try {
      const r = await fetch("/api/crud/locations?pageSize=200");
      const data = (await r.json()) as { rows: { id: string; name: string }[] };
      setLocations(data.rows ?? []);
    } catch {
      // silencioso
    }
  }, []);
  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  const columns = useMemo(
    () => [
      {
        id: "pedido",
        header: "Pedido",
        cell: ({ row }: { row: { original: OrderRow } }) => (
          <span className="font-semibold tabular-nums">#{row.original.orderNumber}</span>
        ),
      },
      {
        id: "fecha",
        header: "Fecha",
        cell: ({ row }: { row: { original: OrderRow } }) =>
          new Date(row.original.createdAt).toLocaleString("es-MX"),
      },
      {
        id: "cliente",
        header: "Cliente",
        cell: ({ row }: { row: { original: OrderRow } }) => row.original.customerName ?? "—",
      },
      {
        id: "sucursal",
        header: "Sucursal",
        cell: ({ row }: { row: { original: OrderRow } }) => row.original.locationName ?? "—",
      },
      {
        id: "entrega",
        header: "Entrega",
        cell: ({ row }: { row: { original: OrderRow } }) => (
          <span className="text-muted-foreground">{DELIVERY_METHOD_LABELS[row.original.deliveryMethod]}</span>
        ),
      },
      {
        id: "estado",
        header: "Estado",
        cell: ({ row }: { row: { original: OrderRow } }) => (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold",
              ORDER_STATUS_COLORS[row.original.status as keyof typeof ORDER_STATUS_COLORS] ?? "bg-muted text-muted-foreground"
            )}
          >
            <span className="size-1.5 rounded-full bg-current opacity-80" />
            {ORDER_STATUS_LABELS[row.original.status as keyof typeof ORDER_STATUS_LABELS] ?? row.original.status}
          </span>
        ),
      },
      {
        id: "total",
        header: "Total",
        cell: ({ row }: { row: { original: OrderRow } }) => (
          <span className="font-bold tabular-nums">{money(row.original.total)}</span>
        ),
      },
      {
        id: "acciones",
        header: "",
        cell: ({ row }: { row: { original: OrderRow } }) => (
          <div className="flex items-center justify-end gap-1">
            <Button variant="ghost" size="xs" onClick={() => setDetailId(row.original.id)}>
              <Eye className="size-3.5" /> Ver
            </Button>
            {canManage &&
              row.original.status !== "cancelled" &&
              row.original.status !== "delivered" && (
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => router.push(`/admin/orders/${row.original.id}/prepare`)}
                >
                  <PackageCheck className="size-3.5" /> Preparar
                </Button>
              )}
          </div>
        ),
      },
    ],
    [canManage, router]
  );

  return (
    <>
      <PageHeader
        icon={icon}
        title="Pedidos"
        description="Gestiona pedidos en línea: estados, preparación y monitoreo."
        actions={
          <Button size="sm" variant="outline" onClick={() => router.push("/admin/orders/monitoring")}>
            <Radio className="size-4" /> Monitoreo
          </Button>
        }
      />

      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar # o cliente"
                className="h-8 pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8 w-40"
              aria-label="Desde"
            />
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-8 w-40"
              aria-label="Hasta"
            />
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder="Entrega" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las entregas</SelectItem>
                <SelectItem value="pickup">Recoger</SelectItem>
                <SelectItem value="delivery">A domicilio</SelectItem>
              </SelectContent>
            </Select>
            <Select value={locationId} onValueChange={setLocationId}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder="Sucursal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las sucursales</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ToggleGroup type="single" value={activeOnly ? "on" : "off"} onValueChange={(v) => setActiveOnly(v === "on")}>
              <ToggleGroupItem value="on" className="h-8 text-xs">Activos</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_TABS.map((t) => {
              const count = t.value === "all" ? total : (counts[t.value] ?? 0);
              return (
                <Badge
                  key={t.value}
                  variant={status === t.value ? "default" : "secondary"}
                  className="cursor-pointer select-none"
                  onClick={() => setStatus(t.value)}
                >
                  {t.label} <span className="ml-1 tabular-nums opacity-80">{count}</span>
                </Badge>
              );
            })}
          </div>

          <DataTable
            columns={columns}
            data={rows}
            searchable={false}
            showColumnVisibility={false}
            showPagination={false}
            loading={loading}
            emptyMessage="Sin pedidos para los filtros"
            rowKey={(r) => r.id}
          />
        </CardContent>
      </Card>

      {detailId && (
        <OrderDetailDialog
          orderId={detailId}
          canManage={canManage}
          onChanged={() => {
            setDetailId(null);
            load();
          }}
        />
      )}
    </>
  );
}