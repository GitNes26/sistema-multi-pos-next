"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileDown,
  FileSpreadsheet,
  Loader2,
  Printer,
  ReceiptText,
  Search,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogComponent } from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable } from "@/components/base/data-table";
import { crudApi, salesApi, type SaleRow, type SaleDetail } from "@/lib/api";
import { swalError, swalToast } from "@/lib/swal";
import { money, qty } from "@/lib/pos/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/pos/config";
import { cn } from "@/lib/utils";
import { ReturnDialog } from "./return-dialog";

// FASE 9 — Historial de ventas del POS.

interface SalesPageProps {
  canView: boolean;
  icon?: React.ReactNode;
}

interface FilterOption {
  id: string;
  name: string;
}

interface SaleFilters {
  q: string;
  locationId: string;
  employeeId: string;
  cashRegisterId: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: SaleFilters = { q: "", locationId: "", employeeId: "", cashRegisterId: "", from: "", to: "" };

export function SalesPage({ canView, icon }: SalesPageProps) {
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [options, setOptions] = useState<{
    locations: FilterOption[];
    employees: FilterOption[];
    registers: FilterOption[];
  }>({ locations: [], employees: [], registers: [] });
  const [filters, setFilters] = useState<SaleFilters>(EMPTY_FILTERS);
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [busy, setBusy] = useState<"xlsx" | "pdf" | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  // Deep link desde notificaciones: ?q=<folio> precarga la búsqueda.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("q");
    if (initial) setQ(initial);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await salesApi.list({
        page,
        pageSize,
        q: debouncedQ,
        locationId: filters.locationId || undefined,
        employeeId: filters.employeeId || undefined,
        cashRegisterId: filters.cashRegisterId || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      });
      setRows(res.rows);
      setTotal(res.total);
    } catch (err) {
      swalError("No se pudo cargar las ventas", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedQ, filters]);

  useEffect(() => {
    if (canView) load();
  }, [canView, load]);

  const loadOptions = useCallback(async () => {
    try {
      const [locations, employees, registers] = await Promise.all([
        crudApi.list("locations", { pageSize: 250 }).then((r) => r.rows.map((x) => ({ id: String(x.id), name: String(x.name) }))),
        crudApi.list("employees", { pageSize: 250 }).then((r) => r.rows.map((x) => ({ id: String(x.id), name: String(x.fullName ?? "") }))),
        crudApi.list("cashRegisters", { pageSize: 250 }).then((r) => r.rows.map((x) => ({ id: String(x.id), name: String(x.name) }))),
      ]);
      setOptions({ locations, employees, registers });
    } catch {
      // fallo silencioso si no hay datos
    }
  }, []);

  useEffect(() => {
    if (canView) loadOptions();
  }, [canView, loadOptions]);

  const openDetail = async (row: SaleRow) => {
    try {
      const res = await salesApi.detail(row.id);
      setDetail(res.sale);
      setDetailOpen(true);
    } catch (err) {
      swalError("No se pudo cargar el detalle", err instanceof Error ? err.message : undefined);
    }
  };

  const tableColumns = useMemo(
    () => [
      {
        id: "folio",
        header: "Folio",
        cell: ({ row }: { row: { original: SaleRow } }) => (
          <span className="font-medium tabular-nums">#{row.original.locationSaleNumber ?? row.original.saleNumber}</span>
        ),
      },
      {
        id: "fecha",
        header: "Fecha",
        cell: ({ row }: { row: { original: SaleRow } }) =>
          new Date(row.original.createdAt).toLocaleString("es-MX"),
      },
      {
        id: "sucursal",
        header: "Sucursal",
        cell: ({ row }: { row: { original: SaleRow } }) => row.original.locationName,
      },
      {
        id: "cajero",
        header: "Cajero",
        cell: ({ row }: { row: { original: SaleRow } }) => row.original.employeeName ?? row.original.cashierName ?? "—",
      },
      {
        id: "cliente",
        header: "Cliente",
        cell: ({ row }: { row: { original: SaleRow } }) => row.original.customerName ?? "—",
      },
      {
        id: "items",
        header: "Art.",
        cell: ({ row }: { row: { original: SaleRow } }) => row.original.itemCount,
      },
      {
        id: "total",
        header: "Total",
        cell: ({ row }: { row: { original: SaleRow } }) => (
          <span className="font-bold tabular-nums">{money(row.original.total)}</span>
        ),
      },
    ],
    []
  );

  const exportFn = async (format: "xlsx" | "pdf") => {
    setBusy(format);
    try {
      const params = {
        q: debouncedQ,
        locationId: filters.locationId || undefined,
        employeeId: filters.employeeId || undefined,
        cashRegisterId: filters.cashRegisterId || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      };
      if (format === "xlsx") await salesApi.exportXlsx(params);
      else await salesApi.exportPdf(params);
      swalToast("Exportación generada");
    } catch (err) {
      swalError("No se pudo exportar", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const filterChip = (active: boolean) =>
    active ? "bg-primary text-primary-foreground" : "";

  if (!canView) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No tienes permiso para ver el historial de ventas.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <PageHeader
        icon={icon}
        title="Ventas"
        description="Historial de ventas del punto de venta."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => exportFn("xlsx")} disabled={busy !== null}>
              {busy === "xlsx" ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />}
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportFn("pdf")} disabled={busy !== null}>
              {busy === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
              PDF
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative w-full max-w-64">
              <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cliente, cajero, folio…"
                className="h-8 pl-9"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={filters.locationId}
              onValueChange={(v) => setFilters((f) => ({ ...f, locationId: v }))}
            >
              <SelectTrigger className={cn("h-8 w-44 text-xs", filterChip(!!filters.locationId))}>
                <SelectValue placeholder="Sucursal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas las sucursales</SelectItem>
                {options.locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.employeeId}
              onValueChange={(v) => setFilters((f) => ({ ...f, employeeId: v }))}
            >
              <SelectTrigger className={cn("h-8 w-44 text-xs", filterChip(!!filters.employeeId))}>
                <SelectValue placeholder="Empleado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos los empleados</SelectItem>
                {options.employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.cashRegisterId}
              onValueChange={(v) => setFilters((f) => ({ ...f, cashRegisterId: v }))}
            >
              <SelectTrigger className={cn("h-8 w-44 text-xs", filterChip(!!filters.cashRegisterId))}>
                <SelectValue placeholder="Caja" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas las cajas</SelectItem>
                {options.registers.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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

            {(filters.locationId || filters.employeeId || filters.cashRegisterId || filters.from || filters.to) && (
              <Button variant="ghost" size="sm" className="h-8" onClick={() => setFilters(EMPTY_FILTERS)}>
                Limpiar
              </Button>
            )}

            <span className="ml-auto text-sm text-muted-foreground">{total} venta(s)</span>
          </div>

          <DataTable
            columns={tableColumns}
            data={rows}
            searchable={false}
            showColumnVisibility={false}
            showPagination={false}
            loading={loading}
            emptyMessage="Sin ventas"
            rowKey={(r) => r.id}
            onRowClick={openDetail}
            renderCard={(r) => (
              <SaleCard row={r} onOpen={() => openDetail(r)} />
            )}
          />

          {!loading && total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <span className="text-sm tabular-nums text-muted-foreground">
                {from}–{to} de {total}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ←
                </Button>
                <span className="px-2 text-sm tabular-nums text-muted-foreground">
                  {page} / {pageCount}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => p + 1)}
                >
                  →
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {detail && <SaleDetailDialog sale={detail} open={detailOpen} onClose={() => setDetailOpen(false)} />}
    </>
  );
}

function SaleCard({ row, onOpen }: { row: SaleRow; onOpen: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2" onClick={onOpen}>
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">#{row.locationSaleNumber ?? row.saleNumber}</span>
          <Badge variant="secondary">{row.locationName}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {new Date(row.createdAt).toLocaleString("es-MX")} · {row.customerName ?? "Cliente general"}
        </p>
      </div>
      <span className="font-bold tabular-nums">{money(row.total)}</span>
    </div>
  );
}

function SaleDetailDialog({ sale, open, onClose }: { sale: SaleDetail; open: boolean; onClose: () => void }) {
  const [printing, setPrinting] = useState(false);
  const [showReturn, setShowReturn] = useState(false);

  const print = () => {
    setPrinting(true);
    setTimeout(() => window.print(), 60);
  };

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      className="sm:max-w-md"
      icon={printing ? undefined : <ReceiptText className="size-5" />}
      title={printing ? undefined : `Venta #${sale.locationSaleNumber ?? sale.saleNumber}`}
      description={
        printing
          ? undefined
          : `${sale.locationName} · ${new Date(sale.createdAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}`
      }
    >
        {printing ? (
          <>
            <PrintReceipt sale={sale} />
            <Button
              variant="outline"
              onClick={() => setPrinting(false)}
              className="w-full sm:hidden"
            >
              Volver al detalle
            </Button>
          </>
        ) : (
          <>
        <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cajero</span>
                <span>{sale.employeeName ?? sale.cashierName ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Caja</span>
                <span>{sale.registerName ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cliente</span>
                <span>{sale.customerName ?? "—"}</span>
              </div>
              {sale.customerCode && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nº cliente</span>
                  <span>{sale.customerCode}</span>
                </div>
              )}
            </div>

            <div className="border-t pt-3">
              <div className="space-y-2">
                {sale.items.map((i) => (
                  <div key={i.id} className="flex flex-col text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">{i.productName}</span>
                      <span className="font-semibold tabular-nums">{money(i.lineTotal ?? i.totalPrice ?? 0)}</span>
                    </div>
                    {i.bulkQuantityDisplay ? (
                      <p className="text-xs text-muted-foreground">{i.bulkQuantityDisplay}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {qty(i.quantity)} × {money(i.unitPrice)}
                        {i.variantName ? ` · ${i.variantName}` : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{money(sale.subtotal)}</span>
              </div>
              {sale.discounts.map((d, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="tabular-nums text-emerald-600">-{money(d.amount)}</span>
                </div>
              ))}
              {sale.discount > 0 && sale.discounts.length === 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Descuento</span>
                  <span className="tabular-nums text-emerald-600">-{money(sale.discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Impuestos</span>
                <span className="tabular-nums">{money(sale.tax)}</span>
              </div>
              {sale.pointsRedeemedValue > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Puntos canjeados</span>
                  <span className="tabular-nums text-emerald-600">-{money(sale.pointsRedeemedValue)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1 text-base font-bold">
                <span>TOTAL</span>
                <span className="tabular-nums">{money(sale.total)}</span>
              </div>
              {sale.changeGiven > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cambio</span>
                  <span className="tabular-nums">{money(sale.changeGiven)}</span>
                </div>
              )}
            </div>

            <div className="space-y-1 border-t pt-3 text-sm">
              {sale.payments.map((p, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="text-muted-foreground">
                    {p.method in PAYMENT_METHOD_LABELS ? PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] : p.method}
                    {p.reference ? ` (${p.reference})` : ""}
                  </span>
                  <span className="tabular-nums">{money(p.amount)}</span>
                </div>
              ))}
            </div>

            {sale.pointsEarned > 0 && (
              <p className="border-t pt-2 text-sm text-muted-foreground">
                Puntos por esta compra: <span className="font-bold text-foreground">{Math.floor(sale.pointsEarned)}</span>
              </p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowReturn(true)} className="flex-1">
                <Undo2 className="size-4" /> Devolución
              </Button>
              <Button onClick={print} className="flex-1">
                <Printer className="size-4" /> Imprimir
              </Button>
            </div>
          </>
        )}
        <ReturnDialog
          open={showReturn}
          onOpenChange={setShowReturn}
          sale={sale}
        />
    </DialogComponent>
  );
}

function PrintReceipt({ sale }: { sale: SaleDetail }) {
  return (
    <div
      id="receipt-print"
      className="mx-auto w-[80mm] bg-white px-3 py-4 font-mono text-[10px] leading-snug text-black"
    >
      <div className="text-center">
        <p className="text-sm font-bold uppercase leading-tight">{sale.locationName}</p>
        <p>Ticket: #{sale.locationSaleNumber ?? sale.saleNumber}</p>
        <p>{new Date(sale.createdAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</p>
        <p>Cajero: {sale.employeeName ?? sale.cashierName ?? "—"}</p>
      </div>

      <div className="my-2 border-t border-dashed border-black/60" />

      {sale.items.map((i) => (
        <div key={i.id} className="mb-1">
          <p className="font-semibold leading-tight">{i.productName}</p>
          {i.bulkQuantityDisplay && <p className="text-[9px] text-black/70">{i.bulkQuantityDisplay}</p>}
          <div className="flex justify-between">
            <span className="text-[9px]">
              {qty(i.quantity)} × {money(i.unitPrice)}
            </span>
            <span>{money(i.lineTotal ?? i.totalPrice ?? 0)}</span>
          </div>
        </div>
      ))}

      <div className="my-2 border-t border-dashed border-black/60" />

      <div className="space-y-0.5">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{money(sale.subtotal)}</span>
        </div>
        {sale.discounts.map((d, idx) => (
          <div key={idx} className="flex justify-between">
            <span className="truncate pr-2">{d.label}</span>
            <span>-{money(d.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between">
          <span>Impuestos</span>
          <span>{money(sale.tax)}</span>
        </div>
        {sale.pointsRedeemedValue > 0 && (
          <div className="flex justify-between">
            <span>Puntos canjeados</span>
            <span>-{money(sale.pointsRedeemedValue)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-sm">
          <span>TOTAL</span>
          <span>{money(sale.total)}</span>
        </div>
        {sale.changeGiven > 0 && (
          <div className="flex justify-between">
            <span>Cambio</span>
            <span>{money(sale.changeGiven)}</span>
          </div>
        )}
      </div>

      <div className="my-2 border-t border-dashed border-black/60" />

      <div className="space-y-0.5">
        {sale.payments.map((p, idx) => (
          <div key={idx} className="flex justify-between">
            <span>{p.method in PAYMENT_METHOD_LABELS ? PAYMENT_METHOD_LABELS[p.method as keyof typeof PAYMENT_METHOD_LABELS] : p.method}</span>
            <span>{money(p.amount)}</span>
          </div>
        ))}
      </div>

      {sale.pointsEarned > 0 && (
        <p className="mt-1">
          Puntos por esta compra: <span className="font-bold">{Math.floor(sale.pointsEarned)}</span>
        </p>
      )}

      <div className="mt-3 text-center">
        <p>¡Gracias por su compra!</p>
      </div>
    </div>
  );
}