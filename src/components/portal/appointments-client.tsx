"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, CalendarPlus, Loader2, MapPin, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FormCombobox } from "@/components/base/form-combobox";
import { DatePicker } from "@/components/base/date-picker";
import { TextareaField } from "@/components/base/textarea-field";
import { EmptyState } from "@/components/shared/empty-state";
import { swalConfirm, swalError, swalToast } from "@/lib/swal";
import { cn } from "@/lib/utils";

interface Booking {
  services: { variantId: string; name: string; price: number; durationMin: number; staffIds: string[] }[];
  staff: { id: string; fullName: string }[];
  stations: { id: string; name: string }[];
  maxAdvanceDays: number;
  appointments: { id: string; status: string; startsAt: string; endsAt: string; service: string; employee: string | null; station: string | null; canCancel: boolean }[];
}

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const when = (iso: string) => new Date(iso).toLocaleString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const STATUS: Record<string, { label: string; chip: string }> = {
  pending: { label: "Por confirmar", chip: "bg-warning/15 text-warning-ink" },
  confirmed: { label: "Confirmada", chip: "bg-primary/10 text-primary" },
  completed: { label: "Atendida", chip: "bg-success/15 text-success-ink" },
  cancelled: { label: "Cancelada", chip: "bg-muted text-muted-foreground" },
  no_show: { label: "No asististe", chip: "bg-destructive/10 text-destructive" },
};

/** Reserva de citas del portal: servicio, persona y lugar opcionales, día y horario libre. */
export function AppointmentsClient() {
  const [data, setData] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);
  const [variantId, setVariantId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [stationId, setStationId] = useState("");
  const [date, setDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<{ time: string; startsAt: string }[] | null>(null);
  const [slot, setSlot] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/citas", { cache: "no-store", credentials: "include" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "No se pudieron cargar las citas");
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las citas");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const service = data?.services.find((s) => s.variantId === variantId) ?? null;
  const staffOptions = useMemo(() => (data?.staff ?? []).filter((p) => service?.staffIds.includes(p.id)), [data, service]);

  // Horarios libres: se piden cada vez que cambia servicio, persona, lugar o día.
  useEffect(() => {
    setSlot("");
    if (!variantId || !date) {
      setSlots(null);
      return;
    }
    let cancelled = false;
    setSlots(null);
    const qs = new URLSearchParams({ variantId, date: ymd(date) });
    if (employeeId) qs.set("employeeId", employeeId);
    if (stationId) qs.set("stationId", stationId);
    fetch(`/api/portal/citas/slots?${qs}`, { cache: "no-store", credentials: "include" })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (!json.ok) throw new Error(json.error ?? "No se pudieron cargar los horarios");
        setSlots(json.slots);
      })
      .catch((err) => {
        if (cancelled) return;
        setSlots([]);
        swalError("No se pudieron cargar los horarios", err instanceof Error ? err.message : undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [variantId, employeeId, stationId, date]);

  const reset = () => {
    setBooking(false);
    setVariantId("");
    setEmployeeId("");
    setStationId("");
    setDate(null);
    setSlots(null);
    setSlot("");
    setNotes("");
  };

  const submit = async () => {
    if (!variantId || !slot) return;
    setSaving(true);
    try {
      const res = await fetch("/api/portal/citas", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, employeeId: employeeId || null, stationId: stationId || null, startsAt: slot, notes: notes || null }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "No se pudo agendar");
      swalToast(employeeId ? "Cita agendada" : "Cita agendada: el negocio te asignará quién te atiende");
      reset();
      void load();
    } catch (err) {
      swalError("No se pudo agendar", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id: string) => {
    if (!(await swalConfirm("¿Cancelar la cita?", "Podrás agendar otra cuando quieras.", { danger: true, confirmText: "Cancelar cita", cancelText: "Conservar" }))) return;
    const res = await fetch(`/api/portal/citas/${id}`, { method: "DELETE", credentials: "include" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) return swalError("No se pudo cancelar", json.error);
    swalToast("Cita cancelada");
    void load();
  };

  if (error && !data) return <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm font-medium text-destructive">{error}</p>;
  if (!data) return <Skeleton className="h-40 rounded-2xl" />;

  const upcoming = data.appointments.filter((a) => a.status === "pending" || a.status === "confirmed");
  const past = data.appointments.filter((a) => !(a.status === "pending" || a.status === "confirmed"));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last = new Date(today.getTime() + data.maxAdvanceDays * 86_400_000);

  return (
    <div className="space-y-6 pb-6">
      <section aria-label="Agendar una cita" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <CalendarPlus className="size-4" /> Agendar una cita
          </h2>
          {!booking && data.services.length > 0 && (
            <Button size="sm" onClick={() => setBooking(true)}>
              Nueva cita
            </Button>
          )}
        </div>
        {data.services.length === 0 && <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Por ahora el negocio no tiene servicios para agendar en línea.</p>}
        {booking && (
          <div className="space-y-3 rounded-2xl border bg-card p-4">
            <FormCombobox
              label="Servicio"
              required
              value={variantId}
              onChange={(v) => { setVariantId(v); setEmployeeId(""); }}
              options={data.services.map((s) => ({ value: s.variantId, label: s.name, meta: `${money(s.price)} · ${s.durationMin} min` }))}
              placeholder="¿Qué te hacemos?"
            />
            {service && (
              <FormCombobox
                label="Quién te atiende"
                value={employeeId}
                onChange={setEmployeeId}
                onClear={() => setEmployeeId("")}
                options={staffOptions.map((p) => ({ value: p.id, label: p.fullName }))}
                placeholder="Sin preferencia (el negocio lo asigna)"
                helper="Opcional: si no tienes preferencia, te asignamos a quien esté disponible."
              />
            )}
            {service && data.stations.length > 0 && (
              <FormCombobox label="Lugar" value={stationId} onChange={setStationId} onClear={() => setStationId("")} options={data.stations.map((s) => ({ value: s.id, label: s.name }))} placeholder="Sin preferencia" icon={<MapPin className="size-4" />} />
            )}
            {service && (
              <DatePicker label="Día" required value={date} onChange={setDate} clearable={false} disabledBefore={today} disabledAfter={last} />
            )}
            {service && date && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Horarios disponibles</p>
                {slots === null ? (
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                ) : slots.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">No quedan horarios ese día. Prueba con otra fecha{employeeId ? " o sin elegir persona" : ""}.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5">
                    {slots.map((s) => (
                      <button
                        key={s.startsAt}
                        type="button"
                        aria-pressed={slot === s.startsAt}
                        onClick={() => setSlot(s.startsAt)}
                        className={cn("press rounded-lg border px-2 py-2 text-sm font-medium tabular-nums transition-colors", slot === s.startsAt ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}
                      >
                        {s.time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {slot && <TextareaField label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Algo que debamos saber (opcional)" rows={2} />}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={reset}>
                Cancelar
              </Button>
              <Button onClick={() => void submit()} disabled={!slot || saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <CalendarPlus className="size-4" />}
                Agendar
              </Button>
            </div>
          </div>
        )}
      </section>

      <section aria-label="Próximas citas" className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <CalendarClock className="size-4" /> Próximas citas
        </h2>
        {upcoming.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Sin citas próximas" description="Cuando agendes una, aquí la verás." />
        ) : (
          upcoming.map((a) => <AppointmentCard key={a.id} a={a} onCancel={cancel} />)
        )}
      </section>

      {past.length > 0 && (
        <section aria-label="Historial" className="space-y-3">
          <h2 className="text-base font-semibold text-muted-foreground">Historial</h2>
          {past.map((a) => <AppointmentCard key={a.id} a={a} onCancel={cancel} />)}
        </section>
      )}
    </div>
  );
}

function AppointmentCard({ a, onCancel }: { a: Booking["appointments"][number]; onCancel: (id: string) => void }) {
  const status = STATUS[a.status] ?? { label: a.status, chip: "bg-muted text-muted-foreground" };
  return (
    <article className="space-y-1.5 rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{a.service}</p>
          <p className="text-sm tabular-nums text-muted-foreground">{when(a.startsAt)}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", status.chip)}>{status.label}</span>
      </div>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <UserRound className="size-3" /> {a.employee ?? "Por asignar"}
        </span>
        {a.station && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" /> {a.station}
          </span>
        )}
      </p>
      {a.canCancel && (
        <Button variant="ghost" size="sm" className="-ml-2 text-destructive" onClick={() => onCancel(a.id)}>
          <X className="size-4" /> Cancelar
        </Button>
      )}
    </article>
  );
}
