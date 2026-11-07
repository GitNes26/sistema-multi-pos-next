"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  CalendarPlus,
  Check,
  Car,
  CreditCard,
  History,
  Loader2,
  LogIn,
  MapPin,
  MessageSquareText,
  Plus,
  ShieldAlert,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormCombobox } from "@/components/base/form-combobox";
import { InputGroupField } from "@/components/base/input-group-field";
import { DatePicker } from "@/components/base/date-picker";
import { TimePicker } from "@/components/base/time-picker";
import { ymdToDate, dateToYmd } from "@/lib/date-input";
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
  canOverride?: boolean;
  canManageAssets?: boolean;
  onCreated: () => void;
}

export function CitaCreateDialog({
  open,
  onOpenChange,
  day,
  defaultEmployeeId,
  defaultTime,
  staff,
  canOverride = false,
  canManageAssets = false,
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
  const [stations, setStations] = useState<{ id: string; name: string }[]>([]);
  const [stationId, setStationId] = useState("");
  const [assets, setAssets] = useState<{ id: string; label: string; reference: string | null; size: string | null }[]>([]);
  const [assetId, setAssetId] = useState("");
  const [creatingAsset, setCreatingAsset] = useState(false);
  const [newAsset, setNewAsset] = useState({ label: "", reference: "", size: "" });
  const [savingAsset, setSavingAsset] = useState(false);
  // Cuando la política lo permite, quien administra puede continuar dejando un motivo.
  const [overrideReason, setOverrideReason] = useState<string | null>(null);

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
    setStationId("");
    setAssetId("");
    setAssets([]);
    setCreatingAsset(false);
    setNewAsset({ label: "", reference: "", size: "" });
    setOverrideReason(null);
    void loadCustomers("");
    fetch("/api/crud/stations?pageSize=100")
      .then((r) => r.json())
      .then((d) => setStations((d.rows ?? []).filter((s: { isActive?: boolean }) => s.isActive !== false)))
      .catch(() => setStations([]));
  }, [open, day, defaultEmployeeId, defaultTime, staff, loadCustomers]);

  // Los vehículos o fichas son del cliente elegido: al cambiar de cliente se recargan.
  useEffect(() => {
    setAssetId("");
    setCreatingAsset(false);
    if (!customerId) {
      setAssets([]);
      return;
    }
    fetch(`/api/crud/assets?customerId=${encodeURIComponent(customerId)}&pageSize=50`)
      .then((r) => r.json())
      .then((d) => setAssets((d.rows ?? []).filter((a: { isActive?: boolean }) => a.isActive !== false)))
      .catch(() => setAssets([]));
  }, [customerId]);

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
    if (overrideReason !== null && overrideReason.trim().length < 3) return setError("Escribe el motivo para continuar");
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
          stationId: stationId || null,
          assetId: assetId || null,
          ...(overrideReason !== null ? { overrideReason: overrideReason.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.overridable && canOverride) setOverrideReason((r) => r ?? "");
        throw new Error(data.error ?? "No se pudo crear la cita");
      }
      toast.success("Cita agendada");
      onCreated();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cita");
    } finally {
      setSaving(false);
    }
  };

  const createAsset = async () => {
    setSavingAsset(true);
    setError(null);
    try {
      const res = await fetch("/api/crud/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, kind: "vehicle", label: newAsset.label, reference: newAsset.reference, size: newAsset.size }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo guardar el vehículo");
      setAssets((prev) => [data.row, ...prev]);
      setAssetId(data.row.id);
      setCreatingAsset(false);
      setNewAsset({ label: "", reference: "", size: "" });
      toast.success("Vehículo guardado en el cliente");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el vehículo");
    } finally {
      setSavingAsset(false);
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
      dataGuide="agenda-dialog"
      className="sm:max-w-lg"
      footer={
        <>
          {error && <p className="mr-auto text-sm font-medium text-destructive">{error}</p>}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />}
            {overrideReason !== null ? "Agendar con motivo" : "Agendar"}
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
                <InputGroupField label="Nombre completo" required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ana Torres" />
              </div>
              <div className="w-36">
                <InputGroupField label="Teléfono" type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="55…" />
              </div>
              <Button size="sm" onClick={() => void createCustomer()} disabled={savingNew || !newName.trim()}>
                {savingNew ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Crear
              </Button>
            </div>
          )}
        </div>

        <FormCombobox label="Personal" required value={employeeId} onChange={(value) => { setEmployeeId(value); setServiceVariantId(""); }} options={staff.map((person) => ({ value: person.id, label: person.fullName, meta: person.services.length ? `${person.services.length} servicios` : "Sin servicios asignados", disabled: person.services.length === 0 }))} placeholder="Seleccionar personal…" helper="Primero asigna servicios al empleado desde la sección Personal de esta Agenda." />

        <FormCombobox label="Servicio" required value={serviceVariantId} onChange={setServiceVariantId} disabled={!employee} options={services.map((item) => ({ value: item.variantId, label: item.name, meta: `${fmtMoney(item.price)} · ${item.durationMin} min` }))} placeholder={employee ? "Seleccionar servicio…" : "Selecciona primero al personal"} emptyText="Este empleado no tiene servicios asignados" />

        <DatePicker label="Fecha" required value={date ? fromYMD(date) : null} onChange={(value) => setDate(value ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}` : "")} clearable={false} />
        <TimePicker label="Hora" required value={time} onChange={(value) => setTime(value ?? "")} clearable={false} />

        <InputGroupField required label="Duración" rightAddon="min" helper="Se propone la duración configurada para el servicio; puedes ajustarla para esta cita."
            type="number"
            min={5}
            max={480}
            step={5}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />

        {stations.length > 0 && (
          <FormCombobox label="Lugar de atención" value={stationId} onChange={setStationId} onClear={() => setStationId("")} options={stations.map((s) => ({ value: s.id, label: s.name }))} placeholder="Silla, bahía… (opcional)" icon={<MapPin className="size-4" />} />
        )}

        {customerId && (
          <div className="sm:col-span-2">
            <FormCombobox
              label="Vehículo o ficha del cliente"
              value={assetId}
              onChange={setAssetId}
              onClear={() => setAssetId("")}
              onCreate={canManageAssets ? () => setCreatingAsset((v) => !v) : undefined}
              options={assets.map((a) => ({ value: a.id, label: a.label, meta: [a.reference, a.size].filter(Boolean).join(" · ") || undefined }))}
              placeholder={assets.length ? "Elige uno de sus vehículos (opcional)" : "Este cliente aún no tiene vehículos registrados"}
              icon={<Car className="size-4" />}
            />
            {creatingAsset && (
              <div className="mt-2 grid gap-2 rounded-xl border bg-muted/40 p-2.5 sm:grid-cols-3">
                <InputGroupField label="Nombre" value={newAsset.label} onChange={(e) => setNewAsset({ ...newAsset, label: e.target.value })} placeholder="Tsuru gris" containerClassName="sm:col-span-1" />
                <InputGroupField label="Placa" value={newAsset.reference} onChange={(e) => setNewAsset({ ...newAsset, reference: e.target.value })} placeholder="ABC-123" />
                <InputGroupField label="Tamaño" value={newAsset.size} onChange={(e) => setNewAsset({ ...newAsset, size: e.target.value })} placeholder="chico, mediano…" />
                <div className="sm:col-span-3">
                  <Button size="sm" onClick={() => void createAsset()} disabled={savingAsset || !(newAsset.label.trim() || newAsset.reference.trim())}>
                    {savingAsset ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    Guardar vehículo
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {overrideReason !== null && (
          <div className="space-y-1.5 rounded-xl border border-warning/50 bg-warning/10 p-3 sm:col-span-2">
            <p className="flex items-center gap-1.5 text-sm font-medium"><ShieldAlert className="size-4" /> La política no lo permite normalmente</p>
            <Textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Motivo para continuar de todos modos (queda en el historial)" rows={2} />
          </div>
        )}

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
  canCheckIn?: boolean;
  canOverride?: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

export function CitaDetailDialog({ cita, canManage, canCheckIn = false, canOverride = false, onOpenChange, onChanged }: DetailDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [method, setMethod] = useState<"cash" | "card">("cash");
  const [result, setResult] = useState<{ saleNumber: string; total: number } | null>(null);
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [duration, setDuration] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
  const [overrideReason, setOverrideReason] = useState<string | null>(null);
  const [overrideFor, setOverrideFor] = useState<"reschedule" | "checkin" | null>(null);
  const [events, setEvents] = useState<CitaEvent[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const loadHistory = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/agenda/${id}/history`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.ok) setEvents(data.events);
    } catch {
      /* el historial es de consulta: si falla, se deja vacío */
    }
  }, []);

  useEffect(() => {
    if (!cita) return;
    setError(null);
    setResult(null);
    setCheckingOut(false);
    setRescheduling(false);
    setOverrideReason(null);
    setOverrideFor(null);
    setEvents(null);
    setShowHistory(false);
    void loadHistory(cita.id);
    const d = new Date(cita.startsAt);
    setTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    setDate(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    );
    setDuration(String(cita.durationMin));
  }, [cita, loadHistory]);

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
    if (overrideFor === "reschedule" && (overrideReason ?? "").trim().length < 3) return setError("Escribe el motivo para continuar");
    setBusy(true);
    setError(null);
    try {
      const startsAt = fromDateInput(fromYMD(date), time);
      const res = await fetch(`/api/agenda/${cita.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt: startsAt.toISOString(), durationMin: Number(duration), ...(overrideFor === "reschedule" ? { overrideReason: overrideReason!.trim() } : {}) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.overridable && canOverride) {
          setOverrideFor("reschedule");
          setOverrideReason((r) => r ?? "");
        }
        throw new Error(data.error ?? "No se pudo reprogramar");
      }
      toast.success("Cita reprogramada");
      onChanged();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reprogramar");
    } finally {
      setBusy(false);
    }
  };

  const checkIn = async () => {
    if (overrideFor === "checkin" && (overrideReason ?? "").trim().length < 3) return setError("Escribe el motivo para continuar");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/agenda/${cita.id}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(overrideFor === "checkin" ? { overrideReason: overrideReason!.trim() } : {}),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.overridable && canOverride) {
          setOverrideFor("checkin");
          setOverrideReason((r) => r ?? "");
        }
        throw new Error(data.error ?? "No se pudo registrar la llegada");
      }
      toast.success("Llegada registrada");
      onChanged();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la llegada");
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
        {(cita.station || cita.asset) && (
          <div className="col-span-2 flex flex-wrap gap-x-4 gap-y-1">
            {cita.station && (
              <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5 text-muted-foreground" /> {cita.station.name}</span>
            )}
            {cita.asset && (
              <span className="inline-flex items-center gap-1.5"><Car className="size-3.5 text-muted-foreground" /> {cita.asset.label}{cita.asset.reference ? ` · ${cita.asset.reference}` : ""}</span>
            )}
          </div>
        )}
        {cita.checkedInAt && (
          <p className="col-span-2 inline-flex items-center gap-1.5 text-xs font-medium text-success-ink"><LogIn className="size-3.5" /> Llegó a las {fmtTime(cita.checkedInAt)}</p>
        )}
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
                <DatePicker required label="Fecha" value={ymdToDate(date)} onChange={(d) => setDate(dateToYmd(d))} />
              </div>
              <div>
                <TimePicker required label="Hora" value={time || null} onChange={(v) => setTime(v ?? "")} clearable={false} />
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
                {overrideFor === "reschedule" ? "Guardar con motivo" : "Guardar"}
              </Button>
              {overrideFor === "reschedule" && (
                <div className="w-full space-y-1.5 rounded-lg border border-warning/50 bg-warning/10 p-2.5">
                  <p className="flex items-center gap-1.5 text-sm font-medium"><ShieldAlert className="size-4" /> La política no lo permite normalmente</p>
                  <Textarea value={overrideReason ?? ""} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Motivo para continuar de todos modos (queda en el historial)" rows={2} />
                </div>
              )}
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
            <p className="flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-2 text-sm font-medium text-success-ink">
              <Check className="size-4" /> Venta {result.saleNumber} por {fmtMoney(result.total)} registrada.
            </p>
          )}
        </div>
      ) : cita.saleId ? (
        <p className="rounded-lg bg-success/10 px-3 py-2 text-sm font-medium text-success-ink">
          Cita cobrada: la venta ya quedó registrada con puntos para el cliente.
        </p>
      ) : null}

      {canCheckIn && !cita.checkedInAt && (cita.status === "pending" || cita.status === "confirmed" || cita.status === "no_show") && (
        <div className="space-y-2">
          {overrideFor === "checkin" && (
            <div className="space-y-1.5 rounded-lg border border-warning/50 bg-warning/10 p-2.5">
              <p className="flex items-center gap-1.5 text-sm font-medium"><ShieldAlert className="size-4" /> Pasó la tolerancia de llegada</p>
              <Textarea value={overrideReason ?? ""} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Motivo para recibirlo de todos modos (queda en el historial)" rows={2} />
            </div>
          )}
          <Button variant="outline" className="w-full" onClick={() => void checkIn()} disabled={busy}>
            <LogIn className="size-4" /> {overrideFor === "checkin" ? "Recibir con motivo" : "Llegó"}
          </Button>
        </div>
      )}

      {/* Historial */}
      <div className="space-y-2">
        <button type="button" className="flex w-full items-center justify-between text-sm font-semibold" onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory}>
          <span className="inline-flex items-center gap-1.5"><History className="size-4" /> Historial{events ? ` (${events.length})` : ""}</span>
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
                  <p className="font-medium">{describeEvent(e)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(e.at).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {e.actor ? ` · ${e.actor}` : " · Automático"}
                  </p>
                  {e.reason && <p className="text-xs">Motivo: {e.reason}</p>}
                </li>
              ))
            )}
          </ol>
        )}
      </div>

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
            className="flex-1 text-destructive"
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

// ── Historial ────────────────────────────────────────────────────────────────

interface CitaEvent {
  id: string;
  type: string;
  fromStartsAt: string | null;
  toStartsAt: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  at: string;
  actor: string | null;
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

const statusLabel = (s: string | null) => (s && s in STATUS_META ? STATUS_META[s as keyof typeof STATUS_META].label : (s ?? "—"));

function describeEvent(e: CitaEvent): string {
  switch (e.type) {
    case "created":
      return `Cita agendada para ${when(e.toStartsAt)}`;
    case "rescheduled":
      return `Reagendada de ${when(e.fromStartsAt)} a ${when(e.toStartsAt)}`;
    case "checked_in":
      return "El cliente llegó";
    case "auto_no_show":
      return "Cita perdida: no llegó dentro de la tolerancia";
    case "override":
      return e.toStartsAt ? `Agendada para ${when(e.toStartsAt)} saltando la política` : "Llegada recibida fuera de la tolerancia";
    default:
      return `Estado: ${statusLabel(e.fromStatus)} → ${statusLabel(e.toStatus)}`;
  }
}
