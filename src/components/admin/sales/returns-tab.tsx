"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle,
  Eye,
  Loader2,
  Search,
  Tag,
  Ticket,
  Undo2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DialogComponent } from "@/components/ui/dialog";
import { InputGroupField } from "@/components/base/input-group-field";
import { DatePicker } from "@/components/base/date-picker";
import { FormCombobox } from "@/components/base/form-combobox";
import { salesApi, crudApi, type SaleReturnWithSale, type SaleReturnDetail } from "@/lib/api";
import type { ComboboxOption } from "@/components/base/form-combobox";
import { swalError, swalConfirm } from "@/lib/swal";
import { toast } from "sonner";
import { money, qty } from "@/lib/pos/money";

const RETURN_TYPE_LABELS: Record<string, string> = {
  refund: "Reembolso",
  coupon: "Cupón",
  points: "Puntos",
  exchange: "Cambio",
};

const RETURN_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  completed: "Completada",
  rejected: "Rechazada",
};

const RETURN_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "default",
  completed: "secondary",
  rejected: "destructive",
};

interface Props {
  canView: boolean;
  canManage: boolean;
}

export function ReturnsTab({ canView, canManage }: Props) {
  const [rows, setRows] = useState<SaleReturnWithSale[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({
    status: "",
    returnType: "",
    locationId: "",
    from: "" as string | undefined,
    to: "" as string | undefined,
  });
  const [detail, setDetail] = useState<SaleReturnDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [locations, setLocations] = useState<ComboboxOption[]>([]);

  useEffect(() => {
    setPage(1);
  }, [filters, q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await salesApi.listReturns({
        page,
        pageSize,
        status: filters.status || undefined,
        returnType: filters.returnType || undefined,
        locationId: filters.locationId || undefined,
        from: filters.from,
        to: filters.to,
      });
      const allRows = res.rows ?? [];
      // Client-side search by folio or customer name
      const filtered = q.trim()
        ? allRows.filter((r) => {
            const search = q.toLowerCase();
            return (
              r.id.toLowerCase().includes(search) ||
              r.sale?.customer?.fullName?.toLowerCase().includes(search) ||
              String(r.sale?.locationSaleNumber ?? "").includes(search)
            );
          })
        : allRows;
      setRows(filtered);
      setTotal(res.total ?? 0);
    } catch (err) {
      swalError("No se pudieron cargar las devoluciones", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters, q]);

  useEffect(() => {
    if (canView) load();
  }, [canView, load]);

  useEffect(() => {
    crudApi.list("locations", { pageSize: 250 })
      .then((r) => setLocations(r.rows.map((x) => ({ value: String(x.id), label: String(x.name) }))))
      .catch(() => {});
  }, []);

  const openDetail = async (row: SaleReturnWithSale) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const res = await salesApi.returnDetail(row.id);
      setDetail(res.return);
    } catch (err) {
      swalError("Error", err instanceof Error ? err.message : undefined);
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApprove = async (returnId: string) => {
    const ok = await swalConfirm("¿Aprobar devolución?", "Se marcará como aprobada y quedará lista para procesar.");
    if (!ok) return;
    setActionBusy(returnId);
    try {
      await salesApi.approveReturn(returnId);
      toast.success("Devolución aprobada");
      load();
      if (detail?.id === returnId) {
        const res = await salesApi.returnDetail(returnId);
        setDetail(res.return);
      }
    } catch (err) {
      swalError("Error", err instanceof Error ? err.message : undefined);
    } finally {
      setActionBusy(null);
    }
  };

  const handleReject = async (returnId: string) => {
    const ok = await swalConfirm("¿Rechazar devolución?", "Esta acción no se puede deshacer.");
    if (!ok) return;
    setActionBusy(returnId);
    try {
      await salesApi.rejectReturn(returnId);
      toast.success("Devolución rechazada");
      load();
      if (detail?.id === returnId) {
        const res = await salesApi.returnDetail(returnId);
        setDetail(res.return);
      }
    } catch (err) {
      swalError("Error", err instanceof Error ? err.message : undefined);
    } finally {
      setActionBusy(null);
    }
  };

  const handleComplete = async (returnId: string) => {
    const ok = await swalConfirm(
      "¿Procesar devolución?",
      "Se aplicará el reembolso/bonificación y se reestacionará el inventario."
    );
    if (!ok) return;
    setActionBusy(returnId);
    try {
      await salesApi.completeReturn(returnId);
      toast.success("Devolución procesada");
      load();
      if (detail?.id === returnId) {
        const res = await salesApi.returnDetail(returnId);
        setDetail(res.return);
      }
    } catch (err) {
      swalError("Error", err instanceof Error ? err.message : undefined);
    } finally {
      setActionBusy(null);
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-2">
        <InputGroupField
          type="search"
          placeholder="Buscar por folio o cliente…"
          leftIcon={<Search className="size-4" />}
          className="w-full max-w-56"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <FormCombobox
          label="Estatus"
          options={[
            { value: "pending", label: "Pendiente" },
            { value: "approved", label: "Aprobada" },
            { value: "completed", label: "Completada" },
            { value: "rejected", label: "Rechazada" },
          ]}
          value={filters.status || null}
          onChange={(v) => setFilters((f) => ({ ...f, status: v ?? "" }))}
          clearable
          placeholder="Todos"
          className="w-40"
        />
        <FormCombobox
          label="Tipo"
          options={[
            { value: "refund", label: "Reembolso" },
            { value: "coupon", label: "Cupón" },
            { value: "points", label: "Puntos" },
            { value: "exchange", label: "Cambio" },
          ]}
          value={filters.returnType || null}
          onChange={(v) => setFilters((f) => ({ ...f, returnType: v ?? "" }))}
          clearable
          placeholder="Todos"
          className="w-40"
        />
        <FormCombobox
          label="Sucursal"
          options={locations}
          value={filters.locationId || null}
          onChange={(v) => setFilters((f) => ({ ...f, locationId: v ?? "" }))}
          clearable
          placeholder="Todas"
          searchable
          className="w-44"
        />
        <DatePicker
          label="Desde"
          value={filters.from ? new Date(filters.from + "T00:00:00") : null}
          onChange={(d) => setFilters((f) => ({ ...f, from: d ? d.toISOString().slice(0, 10) : undefined }))}
        />
        <DatePicker
          label="Hasta"
          value={filters.to ? new Date(filters.to + "T00:00:00") : null}
          onChange={(d) => setFilters((f) => ({ ...f, to: d ? d.toISOString().slice(0, 10) : undefined }))}
        />
      </div>

      {/* Listado */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Undo2 className="mb-2 size-8" />
            <p>No hay devoluciones registradas</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Undo2 className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      Dev. #{row.id.slice(-6).toUpperCase()}
                    </span>
                    <Badge variant={RETURN_STATUS_VARIANT[row.status] ?? "outline"}>
                      {RETURN_STATUS_LABELS[row.status] ?? row.status}
                    </Badge>
                    <Badge variant="secondary">
                      {RETURN_TYPE_LABELS[row.returnType] ?? row.returnType}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Venta #{row.sale?.locationSaleNumber ?? row.sale?.saleNumber ?? "—"}
                    {row.sale?.customer?.fullName ? ` · ${row.sale.customer.fullName}` : ""}
                    {" · "}
                    {new Date(row.createdAt).toLocaleDateString("es-MX", { dateStyle: "short" })}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums">
                  {money(Number(row.total))}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => openDetail(row)}
                  >
                    <Eye className="size-4" />
                  </Button>
                  {canManage && row.status === "pending" && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-emerald-600"
                        disabled={actionBusy === row.id}
                        onClick={() => handleApprove(row.id)}
                      >
                        {actionBusy === row.id ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle className="size-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive"
                        disabled={actionBusy === row.id}
                        onClick={() => handleReject(row.id)}
                      >
                        <XCircle className="size-4" />
                      </Button>
                    </>
                  )}
                  {canManage && row.status === "approved" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-primary"
                      disabled={actionBusy === row.id}
                      onClick={() => handleComplete(row.id)}
                    >
                      {actionBusy === row.id ? <Loader2 className="size-4 animate-spin" /> : <Tag className="size-4" />}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Paginación */}
          {pageCount > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{total} devoluciones</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  ←
                </Button>
                <span>{page} / {pageCount}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
                  →
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Dialog detalle */}
      <DialogComponent open={detailOpen} onOpenChange={setDetailOpen} size="lg">
        {detailLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : detail ? (
          <ReturnDetailContent
            detail={detail}
            canManage={canManage}
            onApprove={() => handleApprove(detail.id)}
            onReject={() => handleReject(detail.id)}
            onComplete={() => handleComplete(detail.id)}
            busy={actionBusy === detail.id}
          />
        ) : null}
      </DialogComponent>
    </div>
  );
}

function ReturnDetailContent({
  detail,
  canManage,
  onApprove,
  onReject,
  onComplete,
  busy,
}: {
  detail: SaleReturnDetail;
  canManage: boolean;
  onApprove: () => void;
  onReject: () => void;
  onComplete: () => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">
            Dev. #{detail.id.slice(-6).toUpperCase()}
          </h3>
          <p className="text-sm text-muted-foreground">
            Venta #{detail.sale?.locationSaleNumber ?? detail.sale?.saleNumber}
            {" · "}
            {new Date(detail.createdAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={RETURN_STATUS_VARIANT[detail.status] ?? "outline"}>
            {RETURN_STATUS_LABELS[detail.status]}
          </Badge>
          <Badge variant="secondary">
            {RETURN_TYPE_LABELS[detail.returnType]}
          </Badge>
        </div>
      </div>

      {/* Info de la venta original */}
      {detail.sale && (
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cliente</span>
            <span>{detail.sale.customerName ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total venta</span>
            <span className="font-medium tabular-nums">{money(Number(detail.sale.total))}</span>
          </div>
        </div>
      )}

      {/* Items devueltos */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Productos devueltos</p>
        {detail.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
            <div>
              <p className="font-medium">{item.productName}</p>
              {item.variantName && <p className="text-xs text-muted-foreground">{item.variantName}</p>}
              {item.reason && <p className="text-xs text-muted-foreground italic">Motivo: {item.reason}</p>}
              <p className="text-xs text-muted-foreground">
                Cant: {qty(item.quantity)} × {money(Number(item.unitPrice))}
                {item.restockable ? " · Re-estacionable" : ""}
              </p>
            </div>
            <span className="font-bold tabular-nums">{money(Number(item.lineTotal))}</span>
          </div>
        ))}
      </div>

      {/* Resumen */}
      <div className="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">{money(Number(detail.subtotal))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">IVA</span>
          <span className="tabular-nums">{money(Number(detail.tax))}</span>
        </div>
        <div className="flex justify-between border-t pt-1 font-bold">
          <span>Total devolución</span>
          <span className="tabular-nums">{money(Number(detail.total))}</span>
        </div>
      </div>

      {/* Info de resolución */}
      {detail.status === "completed" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-800 dark:bg-emerald-950">
          <p className="font-medium text-emerald-700 dark:text-emerald-400">Procesada</p>
          {detail.couponCode && (
            <p>Cupón generado: <code className="font-bold">{detail.couponCode}</code> — {money(Number(detail.couponAmount ?? 0))}</p>
          )}
          {detail.pointsAwarded && Number(detail.pointsAwarded) > 0 && (
            <p>Puntos bonificados: <span className="font-bold">{qty(detail.pointsAwarded)}</span></p>
          )}
        </div>
      )}

      {detail.status === "rejected" && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-medium text-destructive">Rechazada</p>
        </div>
      )}

      {/* Motivo */}
      {detail.reason && (
        <div className="text-sm">
          <span className="text-muted-foreground">Motivo: </span>
          {detail.reason}
        </div>
      )}
      {detail.notes && (
        <div className="text-sm">
          <span className="text-muted-foreground">Notas: </span>
          {detail.notes}
        </div>
      )}

      {/* Acciones */}
      <div className="flex gap-2 border-t pt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(salesApi.returnTicketUrl(detail.id), "_blank")}
        >
          <Ticket className="size-4" /> Ticket PDF
        </Button>
        <div className="flex-1" />
        {canManage && detail.status === "pending" && (
          <>
            <Button variant="destructive" size="sm" disabled={busy} onClick={onReject}>
              <XCircle className="size-4" /> Rechazar
            </Button>
            <Button variant="default" size="sm" disabled={busy} onClick={onApprove}>
              <CheckCircle className="size-4" /> Aprobar
            </Button>
          </>
        )}
        {canManage && detail.status === "approved" && (
          <Button size="sm" disabled={busy} onClick={onComplete}>
            <Tag className="size-4" /> Procesar devolución
          </Button>
        )}
      </div>
    </div>
  );
}
