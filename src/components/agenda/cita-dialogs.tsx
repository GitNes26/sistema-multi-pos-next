"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  CalendarPlus,
  Check,
  CreditCard,
  Loader2,
  MessageSquareText,
  Plus,
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
  type AgendaCita,
  type AgendaStaff,
  fmtMoney,
  fmtTime,
  fromDateInput,
  fromYMD,
  STATUS_META,
} from "./agenda-types";

interface CustomerRow {
  id: string;
  customerCode: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
}

// ── Crear cita ───────────────────────────────────────────────────────────────

interface CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Día visible en la agenda (para el campo de fecha). */
  day: Date;
  defaultEmployeeId?: string | null;
  defaultTime?: string;
  staff: AgendaStaff[];
  onCreated: () => void;
}

export function CitaCreateDialog({
  open,
  onOpenChange,
  day,
  defaultEmployeeId,
  defaultTime,
  staff,
  onCreated,
}: CreateDialogProps) {
  const [employeeId, setEmployeeId] = useState<string>("");
  const [serviceVariantId, setServiceVariantId] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [duration, setDuration] = useState<string>("30");
  const [notes, setNotes] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async (q: string) => {
    try {
      const res = await fetch(`/api/crud/customers?pageSize=100&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (res.ok && data.ok) setCustomers(data.rows ?? []);
    } catch {
      /* silencioso: el diálogo muestra lo que alcanzó a cargar */
    }
  }, []);

  // Reinicia el formulario una sola vez por apertura (aunque staff o el día
  // cambien mientras el diálogo está cerrado, no se pisan los valores).
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
    const d = new Date(day);
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    setDate(ymd);
    setTime(defaultTime ?? "10:00");
    setEmployeeId(defaultEmployeeId ?? staff[0]?.id ?? "");
    setServiceVariantId("");
    setDuration("30");
    setCustomerId("");
    setCustomers([]);
    void loadCustomers("");
  }, [open, day, defaultEmployeeId, defaultTime, staff, loadCustomers]);

  const employee = staff.find((s) => s.id === employeeId);
  const services = employee?.services ?? [];
  const service = services.find((s) => s.variantId === serviceVariantId);

  // Al cambiar el servicio se sugiere su duración asignada.
  useEffect(() => {
    if (service) setDuration(String(service.durationMin));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceVariantId]);

  const customerOptions = useMemo(
    () =>
      customers.map((c) => ({
        value: c.id,
        label: c.fullName,
        meta: c.phone ?? c.email ?? c.customerCode ?? undefined,
      })),
    [customers]
  );

  const submit = async () => {
    setError(null);
    if (!customerId) return setError("Selecciona o crea el cliente");
    if (!employeeId) return setError("Selecciona al personal");
    if (!serviceVariantId) return setError("Selecciona el servicio");
    const startsAt = fromDateInput(fromYMD(date), time);
    const durationMin = Number(duration);
    if (!Number.isFinite(durationMin) || durationMin < 5 || durationMin > 480) {
      return setError("Duración inválida (5–480 min)");
    }
    setSaving(true);
    try {
      const res = await fetch("/api/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          employeeId,
          variantId: serviceVariantId,
          startsAt: startsAt.toISOString(),
          durationMin,
          notes: notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo crear la cita");
      toast.success("Cita agendada");
      onCreated();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cita");
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <DialogComponent
      open={open}
      onOpenChange={onOpenChange}
      icon={<CalendarPlus className="size-5 text-primary" />}
      title="Agendar cita"
      description="Cliente, personal y servicio. El horario se valida contra la agenda del empleado."
      className="sm:max-w-lg"
      footer={
        <>
          {error && <p className="mr-auto text-sm font-medium text-destructive">{error}</p>}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />}
            Agendar
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormCombobox
            label="Cliente"
            required
            value={customerId}
            onChange={setCustomerId}
            onCreate={() => setCreatingNew((v) => !v)}
            options={customerOptions}
            placeholder="Buscar o crear cliente…"
            searchPlaceholder="Nombre, teléfono o nº de cliente…"
            onSync={async () => {
              await loadCustomers("");
            }}
          />
          {creatingNew && (
            <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl border bg-muted/40 p-2.5">
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
        </div>

        <div>
          <Label className="text-xs">Personal</Label>
          <Select value={employeeId} onValueChange={(v) => { setEmployeeId(v); setServiceVariantId(""); }}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar…" />
            </SelectTrigger>
            <SelectContent>
              {staff.map((s) => (
                <SelectItem key={s.id} value={s.id} disabled={s.services.length === 0}>
                  {s.fullName}
                  {s.services.length === 0 ? " (sin servicios)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Servicio</Label>
          <Select value={serviceVariantId} onValueChange={setServiceVariantId} disabled={!employee}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Seleccionar…" />
            </SelectTrigger>
            <SelectContent>
              {services.length === 0 && (
                <p className="px-2 py-1.5 text-sm text-muted-foreground">
                  Este empleado no tiene servicios asignados.
                </p>
              )}
              {services.map((sv) => (
                <SelectItem key={sv.variantId} value={sv.variantId}>
                  {sv.name} · {fmtMoney(sv.price)} · {sv.durationMin} min
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Fecha</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Hora</Label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>

        <div>
          <Label className="text-xs">Duración (min)</Label>
          <Input
            type="number"
            min={5}
            max={480}
            step={5}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <Label className="text-xs">Notas</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej. cliente pide decoloración previa"
            rows={2}
          />
        </div>
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
  cita: AgendaCita | null;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

export function CitaDetailDialog({ cita, canManage, onOpenChange, onChanged }: DetailDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [method, setMethod] = useState<"cash" | "card">("cash");
  const [result, setResult] = useState<{ saleNumber: string; total: number } | null>(null);
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [duration, setDuration] = useState("");
  const [rescheduling, setRescheduling] = useState(false);

  useEffect(() => {
    if (!cita) return;
    setError(null);
    setResult(null);
    setCheckingOut(false);
    setRescheduling(false);
    const d = new Date(cita.startsAt);
    setTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    setDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
    setDuration(String(cita.durationMin));
  }, [cita]);

  if (!cita) return null;
  const meta = STATUS_META[cita.status];

  const act = async (status: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/agenda/${cita.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo actualizar");
      toast.success(
        status === "confirmed"
          ? "Cita confirmada"
          : status === "cancelled"
            ? "Cita cancelada"
            : "Registrado como no asistió"
      );
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
      const startsAt = fromDateInput(fromYMD(date), time);
      const res = await fetch(`/api/agenda/${cita.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt: startsAt.toISOString(), durationMin: Number(duration) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo reprogramar");
      toast.success("Cita reprogramada");
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
      const res = await fetch(`/api/agenda/${cita.id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo cobrar");
      setResult({ saleNumber: data.saleNumber, total: data.total });
      toast.success("Cita cobrada");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cobrar");
    } finally {
      setBusy(false);
    }
  };

  const editable = canManage && cita.status !== "completed" && cita.status !== "cancelled" && cita.status !== "no_show";

  return (
    <DialogComponent
      open={Boolean(cita)}
      onOpenChange={onOpenChange}
      icon={<UserRound className="size-5 text-primary" />}
      title={cita.customer?.fullName ?? "Cliente sin nombre"}
      description={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold", meta.chip)}>
            <span className={cn("size-1.5 rounded-full", meta.dot)} />
            {meta.label}
          </span>
          <span className="text-muted-foreground">
            {fmtTime(cita.startsAt)} – {fmtTime(cita.endsAt)}
          </span>
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
      {/* Datos de la cita */}
      <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/30 p-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Servicio</p>
          <p className="font-semibold">{cita.service.name}</p>
          <p className="text-xs text-muted-foreground">
            {cita.durationMin} min · {fmtMoney(cita.service.price)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Personal</p>
          <p className="font-semibold">{cita.employee.fullName}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground">Contacto</p>
          <p>
            {cita.customer?.phone ?? "Sin teléfono"}
            {cita.customer && (
              <span className="ml-2 text-xs text-muted-foreground">{cita.customer.fullName}</span>
            )}
          </p>
        </div>
        {cita.notes && (
          <div className="col-span-2 flex items-start gap-1.5 rounded-lg bg-background p-2 text-xs">
            <MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <span>{cita.notes}</span>
          </div>
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
              {rescheduling ? "Ocultar" : "Cambiar horario"}
            </button>
          </div>
          {rescheduling && (
            <div className="flex flex-wrap items-end gap-2 rounded-xl border bg-muted/30 p-3">
              <div>
                <Label className="text-xs">Fecha</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Hora</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Min</Label>
                <Input
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </div>
              <Button size="sm" onClick={() => void saveReschedule()} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Guardar
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Checkout (se despliega al pulsar Cobrar) */}
      {checkingOut ? (
        <div className="space-y-3 rounded-xl border p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Cobrar servicio</p>
            <p className="text-lg font-bold text-primary">{fmtMoney(cita.service.price)}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMethod(m.value)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
                  method === m.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "hover:bg-muted"
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
      ) : cita.saleId ? (
        <p className="rounded-lg bg-emerald-100 px-3 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
          Cita cobrada: la venta ya quedó registrada con puntos para el cliente.
        </p>
      ) : null}

      {/* Acciones de estatus */}
      {canManage && cita.status === "pending" && (
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 text-destructive" onClick={() => void act("cancelled")} disabled={busy}>
            <X className="size-4" /> Cancelar
          </Button>
          <Button className="flex-1" onClick={() => void act("confirmed")} disabled={busy}>
            <Check className="size-4" /> Confirmar
          </Button>
        </div>
      )}
      {canManage && cita.status === "confirmed" && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 text-rose-600"
            onClick={() => void act("no_show")}
            disabled={busy}
            title="El cliente no se presentó"
          >
            <X className="size-4" /> No asistió
          </Button>
          <Button variant="outline" className="flex-1 text-destructive" onClick={() => void act("cancelled")} disabled={busy}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={() => setCheckingOut(true)} disabled={busy}>
            <Banknote className="size-4" /> Cobrar
          </Button>
        </div>
      )}
    </DialogComponent>
  );
}