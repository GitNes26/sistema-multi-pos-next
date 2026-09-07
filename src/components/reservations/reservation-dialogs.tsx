"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  CalendarRange,
  Check,
  CreditCard,
  Loader2,
  MessageSquareText,
  Plus,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormCombobox } from "@/components/base/form-combobox";
import { cn } from "@/lib/utils";
import {
  type RentUnit,
  type ReservationView,
  fmtMoney,
  fromYMD,
  rangeLabel,
  STATUS_META,
  toYMD,
} from "./reservation-types";

interface CustomerRow {
  id: string;
  customerCode: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
}

// ── Nueva reservación ────────────────────────────────────────────────────────

interface LineDraft {
  key: number;
  variantId: string;
  quantity: number;
}

interface CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Día visible (para prellenar entrega). */
  day: Date;
  units: RentUnit[];
  onCreated: () => void;
}

export function ReservationCreateDialog({ open, onOpenChange, day, units, onCreated }: CreateDialogProps) {
  const [customerId, setCustomerId] = useState<string>("");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [startYmd, setStartYmd] = useState("");
  const [endYmd, setEndYmd] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [notes, setNotes] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const keySeq = useRef(1);

  const loadCustomers = useCallback(async (q: string) => {
    try {
      const res = await fetch(`/api/crud/customers?pageSize=100&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (res.ok && data.ok) setCustomers(data.rows ?? []);
    } catch {
      /* silencioso */
    }
  }, []);

  // Reinicia el formulario una sola vez por apertura.
  const prevOpen = useRef(false);
  useEffect(() => {
    if (!open) prevOpen.current = false;
  }, [open]);
  useEffect(() => {
    if (!open || prevOpen.current) return;
    prevOpen.current = true;
    setError(null);
    setSaving(false);
    setNotes("");
    setCreatingNew(false);
    setNewName("");
    setNewPhone("");
    setCustomerId("");
    setCustomers([]);
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    setStartYmd(toYMD(start));
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    setEndYmd(toYMD(end));
    setLines([{ key: keySeq.current++, variantId: "", quantity: 1 }]);
    void loadCustomers("");
  }, [open, day, loadCustomers]);

  const customerOptions = useMemo(
    () =>
      customers.map((c) => ({
        value: c.id,
        label: c.fullName,
        meta: c.phone ?? c.email ?? c.customerCode ?? undefined,
      })),
    [customers]
  );

  const estimated = useMemo(() => {
    let sub = 0;
    for (const line of lines) {
      const unit = units.find((u) => u.variantId === line.variantId);
      if (!unit) continue;
      sub += unit.price * Math.max(1, line.quantity);
    }
    return { subtotal: sub, total: Math.round(sub * 1.16 * 100) / 100 };
  }, [lines, units]);

  const patchLine = (key: number, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const createCustomer = async () => {
    setSavingNew(true);
    setError(null);
    try {
      const res = await fetch("/api/crud/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: newName, phone: newPhone || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo crear el cliente");
      const row = data.row as CustomerRow;
      setCustomers((prev) => [row, ...prev.filter((c) => c.id !== row.id)]);
      setCustomerId(row.id);
      setCreatingNew(false);
      toast.success("Cliente creado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el cliente");
    } finally {
      setSavingNew(false);
    }
  };

  const submit = async () => {
    setError(null);
    if (!customerId) return setError("Selecciona o crea el cliente");
    const items = lines
      .filter((l) => l.variantId)
      .map((l) => ({ variantId: l.variantId, quantity: l.quantity }));
    if (items.length === 0) return setError("Agrega al menos un artículo a la renta");
    const startsAt = fromYMD(startYmd);
    const endsAt = fromYMD(endYmd);
    if (endsAt.getTime() <= startsAt.getTime()) {
      return setError("La fecha de regreso debe ser posterior a la de entrega");
    }
    setSaving(true);
    try {
      const res = await fetch("/api/reservaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          items,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          notes: notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo crear la reservación");
      toast.success("Reservación creada");
      onCreated();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la reservación");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogComponent
      open={open}
      onOpenChange={onOpenChange}
      icon={<CalendarRange className="size-5 text-primary" />}
      title="Nueva reservación"
      description="Período de la renta y artículos por unidad. Se valida la disponibilidad de cada día."
      className="sm:max-w-xl"
      bodyClassName="space-y-4"
      footer={
        <>
          {error && <p className="mr-auto text-sm font-medium text-destructive">{error}</p>}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <CalendarRange className="size-4" />}
            Reservar
          </Button>
        </>
      }
    >
      <FormCombobox
        label="Cliente"
        required
        value={customerId}
        onChange={setCustomerId}
        onCreate={() => setCreatingNew((v) => !v)}
        options={customerOptions}
        placeholder="Buscar o crear cliente…"
        searchPlaceholder="Nombre, teléfono o nº de cliente…"
        onSync={async () => void loadCustomers("")}
      />
      {creatingNew && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-muted/40 p-2.5">
          <div className="min-w-40 flex-1">
            <Label className="text-xs">Nombre completo</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ana Torres" />
          </div>
          <div className="w-36">
            <Label className="text-xs">Teléfono</Label>
            <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="55…" />
          </div>
          <Button size="sm" onClick={() => void createCustomer()} disabled={savingNew || !newName.trim()}>
            {savingNew ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Crear
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Entrega (día)</Label>
          <Input type="date" value={startYmd} onChange={(e) => setStartYmd(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Regreso (día)</Label>
          <Input type="date" value={endYmd} onChange={(e) => setEndYmd(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Artículos a rentar</Label>
        {lines.map((line) => {
          const unit = units.find((u) => u.variantId === line.variantId);
          return (
            <div key={line.key} className="flex items-end gap-2 rounded-xl border bg-card p-2.5">
              <div className="min-w-0 flex-1">
                <Select
                  value={line.variantId}
                  onValueChange={(v) => patchLine(line.key, { variantId: v, quantity: 1 })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar artículo…" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.variantId} value={u.variantId}>
                        {u.name} · {u.totalUnits} disp. · {fmtMoney(u.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24">
                <Label className="text-xs">Unidades</Label>
                <Input
                  type="number"
                  min={1}
                  max={unit?.totalUnits ?? 1}
                  value={line.quantity}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    const max = unit?.totalUnits ?? 1;
                    patchLine(line.key, { quantity: Number.isFinite(v) ? Math.min(max, Math.max(1, v)) : 1 });
                  }}
                />
              </div>
              {unit && (
                <p className="pb-1 text-xs font-semibold text-muted-foreground">
                  {fmtMoney(unit.price * line.quantity)}
                </p>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                disabled={lines.length === 1}
                aria-label="Quitar artículo"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        })}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLines((prev) => [...prev, { key: keySeq.current++, variantId: "", quantity: 1 }])}
        >
          <Plus className="size-4" /> Agregar artículo
        </Button>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-sm">
        <span className="text-muted-foreground">
          Subtotal {fmtMoney(estimated.subtotal)} · IVA {fmtMoney(estimated.total - estimated.subtotal)}
        </span>
        <span className="text-base font-bold">
          Total estimado {fmtMoney(estimated.total)}
        </span>
      </div>

      <div>
        <Label className="text-xs">Notas</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ej. entrega en domicilio, montaje incluido…"
          rows={2}
        />
      </div>
    </DialogComponent>
  );
}

// ── Detalle + acciones + checkout ────────────────────────────────────────────

const METHODS = [
  { value: "cash", label: "Efectivo", icon: Banknote },
  { value: "card", label: "Tarjeta", icon: CreditCard },
] as const;

interface DetailDialogProps {
  reservation: ReservationView | null;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

export function ReservationDetailDialog({ reservation, canManage, onOpenChange, onChanged }: DetailDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [method, setMethod] = useState<"cash" | "card">("cash");
  const [result, setResult] = useState<{ saleNumber: string; total: number } | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [startYmd, setStartYmd] = useState("");
  const [endYmd, setEndYmd] = useState("");

  useEffect(() => {
    if (!reservation) return;
    setError(null);
    setResult(null);
    setCheckingOut(false);
    setRescheduling(false);
    setStartYmd(toYMD(new Date(reservation.startsAt)));
    setEndYmd(toYMD(new Date(reservation.endsAt)));
  }, [reservation]);

  if (!reservation) return null;
  const meta = STATUS_META[reservation.status];
  const editable =
    canManage && reservation.status !== "completed" && reservation.status !== "cancelled";

  const act = async (status: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservaciones/${reservation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo actualizar");
      toast.success(status === "confirmed" ? "Reservación confirmada" : "Reservación cancelada");
      onChanged();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar");
    } finally {
      setBusy(false);
    }
  };

  const saveReschedule = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservaciones/${reservation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt: fromYMD(startYmd).toISOString(), endsAt: fromYMD(endYmd).toISOString() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo reprogramar");
      toast.success("Reservación reprogramada");
      onChanged();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reprogramar");
    } finally {
      setBusy(false);
    }
  };

  const checkout = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservaciones/${reservation.id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo cobrar");
      setResult({ saleNumber: data.saleNumber, total: data.total });
      toast.success("Reservación cobrada");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cobrar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogComponent
      open={Boolean(reservation)}
      onOpenChange={onOpenChange}
      icon={<UserRound className="size-5 text-primary" />}
      title={reservation.customer?.fullName ?? "Cliente sin nombre"}
      description={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold", meta.chip)}>
            <span className={cn("size-1.5 rounded-full", meta.dot)} />
            {meta.label}
          </span>
          <span className="text-muted-foreground">{rangeLabel(reservation.startsAt, reservation.endsAt)}</span>
        </span>
      }
      className="sm:max-w-md"
      bodyClassName="space-y-4"
      footer={
        <>
          {error && <p className="mr-auto text-sm font-medium text-destructive">{error}</p>}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </>
      }
    >
      <div className="space-y-1.5 rounded-xl border bg-muted/30 p-3">
        {reservation.items.map((it) => (
          <div key={it.variantId} className="flex items-center justify-between text-sm">
            <span>
              {it.name} <span className="text-muted-foreground">× {it.quantity}</span>
            </span>
            <span className="font-semibold">{fmtMoney(it.lineTotal)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between border-t pt-1.5 text-sm font-bold">
          <span>Total</span>
          <span>{fmtMoney(reservation.total)}</span>
        </div>
        <p className="pt-0.5 text-xs text-muted-foreground">
          Tel: {reservation.customer?.phone ?? "—"}
        </p>
        {reservation.notes && (
          <p className="flex items-start gap-1.5 rounded-lg bg-background p-2 text-xs">
            <MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <span>{reservation.notes}</span>
          </p>
        )}
      </div>

      {/* Reprogramar */}
      {editable && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Reprogramar</p>
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => setRescheduling((v) => !v)}
            >
              {rescheduling ? "Ocultar" : "Cambiar fechas"}
            </button>
          </div>
          {rescheduling && (
            <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-muted/30 p-3">
              <div>
                <Label className="text-xs">Entrega</Label>
                <Input type="date" value={startYmd} onChange={(e) => setStartYmd(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Regreso</Label>
                <Input type="date" value={endYmd} onChange={(e) => setEndYmd(e.target.value)} />
              </div>
              <Button size="sm" onClick={() => void saveReschedule()} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Guardar
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Checkout */}
      {checkingOut ? (
        <div className="space-y-3 rounded-xl border p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Cobrar renta</p>
            <p className="text-lg font-bold text-primary">{fmtMoney(reservation.total)}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
                  method === m.value ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
                )}
              >
                <m.icon className="size-4" />
                {m.label}
              </button>
            ))}
          </div>
          <Button className="w-full" onClick={() => void checkout()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
            Cobrar y completar
          </Button>
          {result && (
            <p className="flex items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
              <Check className="size-4" /> Venta {result.saleNumber} por {fmtMoney(result.total)} registrada.
            </p>
          )}
        </div>
      ) : reservation.saleId ? (
        <p className="rounded-lg bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
          Reservación cobrada: venta registrada con puntos para el cliente.
        </p>
      ) : null}

      {/* Acciones de estatus */}
      {canManage && reservation.status === "pending" && (
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 text-destructive" onClick={() => void act("cancelled")} disabled={busy}>
            <X className="size-4" /> Cancelar
          </Button>
          <Button className="flex-1" onClick={() => void act("confirmed")} disabled={busy}>
            <Check className="size-4" /> Confirmar
          </Button>
        </div>
      )}
      {canManage && reservation.status === "confirmed" && (
        <div className="flex gap-2">
          <Button variant="outline" className="text-destructive" onClick={() => void act("cancelled")} disabled={busy}>
            <X className="size-4" /> Cancelar
          </Button>
          <Button className="flex-1" onClick={() => setCheckingOut(true)} disabled={busy}>
            <Banknote className="size-4" /> Cobrar
          </Button>
        </div>
      )}
    </DialogComponent>
  );
}