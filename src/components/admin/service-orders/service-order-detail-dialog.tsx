"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, Car, Check, CreditCard, History, KeyRound, Loader2, MapPin, MessageSquareText, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormCombobox } from "@/components/base/form-combobox";
import { InputGroupField } from "@/components/base/input-group-field";
import { swalConfirm, swalPrompt } from "@/lib/swal";
import { cn } from "@/lib/utils";
import { EVENT_LABEL, elapsed, money, type Flow, type OrderEvent, type ServiceOrder } from "./types";

const METHODS = [
  { value: "cash", label: "Efectivo", icon: Banknote },
  { value: "card", label: "Tarjeta", icon: CreditCard },
] as const;

const STATUS_LABEL: Record<ServiceOrder["status"], string> = { open: "En proceso", ready: "Lista para entregar", delivered: "Entregada", cancelled: "Cancelada" };

export function ServiceOrderDetailDialog({
  order,
  flow,
  canManage,
  onOpenChange,
  onChanged,
}: {
  order: ServiceOrder | null;
  flow: Flow | null;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<"cash" | "card">("cash");
  const [keyTag, setKeyTag] = useState("");
  const [stations, setStations] = useState<{ id: string; name: string }[]>([]);
  const [events, setEvents] = useState<OrderEvent[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [receipt, setReceipt] = useState<{ saleNumber: string; total: number } | null>(null);

  const orderId = order?.id;
  const loadHistory = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/service-orders/${id}`, { cache: "no-store", credentials: "include" });
      const data = await res.json();
      if (res.ok && data.ok) setEvents(data.events);
    } catch {
      /* el historial es de consulta */
    }
  }, []);

  useEffect(() => {
    if (!orderId) return;
    setError(null);
    setReceipt(null);
    setShowHistory(false);
    setEvents(null);
    void loadHistory(orderId);
    fetch("/api/crud/stations?pageSize=100")
      .then((r) => r.json())
      .then((d) => setStations((d.rows ?? []).filter((s: { isActive?: boolean }) => s.isActive !== false)))
      .catch(() => setStations([]));
  }, [orderId, loadHistory]);
  useEffect(() => {
    setKeyTag(order?.keyTag ?? "");
  }, [order?.keyTag, orderId]);
  // Cada cambio (propio o de otra pantalla) refresca el historial abierto.
  const updatedAt = order ? `${order.stage.id}:${order.status}:${order.station?.id ?? ""}:${order.keyTag ?? ""}` : "";
  useEffect(() => {
    if (orderId && showHistory) void loadHistory(orderId);
  }, [updatedAt, orderId, showHistory, loadHistory]);

  if (!order) return null;
  const closed = order.status === "delivered" || order.status === "cancelled";
  const editable = canManage && !closed;

  const patch = async (body: Record<string, unknown>, okMessage?: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/service-orders/${order.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo guardar");
      if (okMessage) toast.success(okMessage);
      onChanged();
      void loadHistory(order.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const checkout = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/service-orders/${order.id}/checkout`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method }) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo cobrar");
      setReceipt({ saleNumber: data.saleNumber, total: data.total });
      toast.success("Orden cobrada y entregada");
      onChanged();
      void loadHistory(order.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cobrar");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    const reason = await swalPrompt("Cancelar la orden", "Motivo (por ejemplo: el cliente se fue)");
    if (reason === null) return;
    if (!(await swalConfirm(`¿Cancelar la orden #${order.number}?`, "Se libera el lugar y queda en el historial.", { danger: true, confirmText: "Cancelar orden", cancelText: "Volver" }))) return;
    await patch({ cancel: true, reason }, "Orden cancelada");
    onOpenChange(false);
  };

  return (
    <DialogComponent
      open={Boolean(order)}
      onOpenChange={onOpenChange}
      icon={<Car className="size-5 text-primary" />}
      title={`Orden #${order.number}`}
      description={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", order.status === "ready" ? "bg-success/15 text-success-ink" : order.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-muted")}>{STATUS_LABEL[order.status]}</span>
          <span className="text-muted-foreground">Recibida hace {elapsed(order.createdAt)}</span>
        </span>
      }
      className="sm:max-w-lg"
      bodyClassName="space-y-4"
      footer={
        <>
          {error && <p className="mr-auto text-sm font-medium text-destructive">{error}</p>}
          {editable && (
            <Button variant="outline" className="text-destructive" onClick={() => void cancel()} disabled={busy}>
              <X className="size-4" /> Cancelar orden
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/30 p-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Cliente</p>
          <p className="font-semibold">{order.customer?.fullName ?? "Cliente de mostrador"}</p>
          {order.customer?.phone && <p className="text-xs text-muted-foreground">{order.customer.phone}</p>}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Vehículo</p>
          <p className="font-semibold">{order.asset?.label ?? "Sin vehículo"}</p>
          <p className="text-xs text-muted-foreground">{[order.asset?.reference, order.asset?.size].filter(Boolean).join(" · ")}</p>
        </div>
        <ul className="col-span-2 space-y-0.5 border-t pt-2">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-2">
              <span>
                {i.quantity > 1 ? `${i.quantity}× ` : ""}
                {i.productName}
                {i.variantName ? ` · ${i.variantName}` : ""}
              </span>
              <span className="tabular-nums">{money(i.lineTotal)}</span>
            </li>
          ))}
          <li className="flex justify-between border-t pt-1 font-semibold">
            <span>Total (antes de impuestos)</span>
            <span className="tabular-nums">{money(order.total)}</span>
          </li>
        </ul>
        {order.indications && (
          <div className="col-span-2 flex items-start gap-1.5 rounded-lg bg-background p-2 text-xs">
            <MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <span>{order.indications}</span>
          </div>
        )}
      </div>

      {flow && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Etapa</p>
          <div className="flex flex-wrap gap-1.5">
            {flow.stages.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={!editable || busy || s.id === order.stage.id}
                onClick={() => void patch({ stageId: s.id })}
                className={cn("press rounded-full border px-3 py-1.5 text-sm", s.id === order.stage.id ? "border-primary bg-primary/10 font-medium text-primary" : "hover:bg-muted/50 disabled:opacity-60")}
                aria-pressed={s.id === order.stage.id}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {editable && (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormCombobox
            label="Lugar de atención"
            value={order.station?.id ?? ""}
            onChange={(id) => void patch({ stationId: id }, "Lugar actualizado")}
            onClear={() => void patch({ stationId: null }, "Lugar quitado")}
            options={stations.map((s) => ({ value: s.id, label: s.name }))}
            placeholder="Sin lugar"
            icon={<MapPin className="size-4" />}
            disabled={busy}
          />
          <div className="flex items-end gap-2">
            <InputGroupField label="Llavero o gancho" value={keyTag} onChange={(e) => setKeyTag(e.target.value)} leftIcon={<KeyRound className="size-4" />} maxLength={20} containerClassName="flex-1" />
            <Button variant="outline" size="icon" aria-label="Guardar llavero" disabled={busy || keyTag.trim().toUpperCase() === (order.keyTag ?? "")} onClick={() => void patch({ keyTag }, "Llavero actualizado")}>
              <Check className="size-4" />
            </Button>
          </div>
        </div>
      )}
      {!editable && (order.station || order.keyTag) && (
        <p className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
          {order.station && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" /> {order.station.name}
            </span>
          )}
          {order.keyTag && (
            <span className="inline-flex items-center gap-1">
              <KeyRound className="size-3.5" /> {order.keyTag}
            </span>
          )}
        </p>
      )}
      {order.employee && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <UserRound className="size-3.5" /> Atiende {order.employee.fullName}
        </p>
      )}

      {canManage && order.status === "ready" && (
        <div className="space-y-3 rounded-xl border p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Cobrar y entregar</p>
            <p className="text-lg font-bold text-primary">{money(order.total)}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map((m) => (
              <button key={m.value} type="button" onClick={() => setMethod(m.value)} aria-pressed={method === m.value} className={cn("press flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium", method === m.value ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}>
                <m.icon className="size-4" /> {m.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">El impuesto de cada servicio se calcula al cobrar con el precio vigente del catálogo.</p>
          <Button className="w-full" onClick={() => void checkout()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />} Cobrar y entregar
          </Button>
        </div>
      )}
      {receipt && (
        <p className="flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-2 text-sm font-medium text-success-ink">
          <Check className="size-4" /> Venta {receipt.saleNumber} por {money(receipt.total)} registrada.
        </p>
      )}
      {order.status === "delivered" && !receipt && <p className="rounded-lg bg-success/10 px-3 py-2 text-sm font-medium text-success-ink">Orden cobrada y entregada: la venta ya quedó ligada con puntos para el cliente.</p>}

      <div className="space-y-2">
        <button type="button" className="flex w-full items-center justify-between text-sm font-semibold" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory}>
          <span className="inline-flex items-center gap-1.5">
            <History className="size-4" /> Historial{events ? ` (${events.length})` : ""}
          </span>
          <span className="text-xs font-medium text-primary">{showHistory ? "Ocultar" : "Ver"}</span>
        </button>
        {showHistory && (
          <ol className="space-y-2 rounded-xl border bg-muted/30 p-3 text-sm">
            {events === null ? (
              <li className="text-muted-foreground">Cargando…</li>
            ) : events.length === 0 ? (
              <li className="text-muted-foreground">Sin movimientos registrados.</li>
            ) : (
              events.map((e) => (
                <li key={e.id} className="space-y-0.5">
                  <p className="font-medium">
                    {EVENT_LABEL[e.type] ?? e.type}
                    {e.detail ? `: ${e.detail}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(e.at).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {e.actor ? ` · ${e.actor}` : " · Automático"}
                  </p>
                </li>
              ))
            )}
          </ol>
        )}
      </div>
    </DialogComponent>
  );
}
