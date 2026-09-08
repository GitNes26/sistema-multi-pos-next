"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Armchair,
  CalendarDays,
  CalendarCheck2,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Minus,
  Plus,
  ScrollText,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InputGroupField } from "@/components/base/input-group-field";
import { swalError, swalToast } from "@/lib/swal";
import { cn } from "@/lib/utils";
import { PlanTableElement, type PlanTable } from "@/components/admin/tables/plan-elements";

// Wizard de reservación a pasos (imagen de referencia "Book a table"):
// 1) Sucursal → 2) Calendario (solo días con la sucursal abierta, dentro de la
// política) + hora/asientos → 3) Salas disponibles (plano, mesas bloqueadas
// indicando por qué) → 4) Datos del comensal + resumen. Compartido por el
// panel administrativo y el portal; el invitado usa variante sin cuenta.
//
// La API de disponibilidad entrega `days`, `slots` y `tables`; la política
// viaja en cada respuesta y se muestra como chips informativos.

export interface WizardLocation {
  id: string;
  name: string;
}

interface PolicyView {
  enabled: boolean;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  maxGuests: number;
  durationMinutes: number;
  slotMinutes: number;
  requireConfirmation: boolean;
  notesText: string | null;
}

interface SlotDetail {
  time: string;
  rooms: { id: string; name: string; total: number; free: number }[];
}

interface SlotTable extends PlanTable {
  roomId: string | null;
  roomName: string | null;
  free: boolean;
}

export interface ReservationWizardProps {
  locations: WizardLocation[];
  /** LocationId preseleccionado (QR de mesa, org de una sola sucursal…). */
  initialLocationId?: string | null;
  /** Nombre/teléfono prefijados (sesión de portal). */
  customerName?: string | null;
  customerPhone?: string | null;
  /** Endpoint POST para crear la reservación (incluye query de org si aplica). */
  createUrl: string;
  /** Base de la API de disponibilidad (incluye query de org si aplica). */
  availabilityUrl: string;
  doneMessage?: string;
  onDone?: () => void;
}

const STEPS = ["Sucursal", "Fecha y hora", "Elegir sala", "Tus datos"] as const;

export function ReservationWizard({
  locations,
  initialLocationId,
  customerName,
  customerPhone,
  createUrl,
  availabilityUrl,
  doneMessage,
  onDone,
}: ReservationWizardProps) {
  const [step, setStep] = useState(initialLocationId && locations.length <= 1 ? 1 : 0);
  const [locationId, setLocationId] = useState(initialLocationId ?? locations[0]?.id ?? "");
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [guests, setGuests] = useState("2");
  const [tableId, setTableId] = useState<string | null>(null);

  const [days, setDays] = useState<string[]>([]);
  const [policy, setPolicy] = useState<PolicyView | null>(null);
  const [slots, setSlots] = useState<SlotDetail[]>([]);
  const [slotTables, setSlotTables] = useState<SlotTable[]>([]);
  const [loadingDays, setLoadingDays] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);

  const [name, setName] = useState(customerName ?? "");
  const [phone, setPhone] = useState(customerPhone ?? "");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ table: number | null; room: string | null } | null>(null);

  const month = useMemo(() => {
    // Mes del calendario anclado al primer día seleccionable (o actual).
    const base = days[0] ? new Date(`${days[0]}T00:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  }, [days]);
  const [monthCursor, setMonthCursor] = useState<Date | null>(null);
  const cursor = monthCursor ?? month;

  const party = Math.max(1, Math.round(Number(guests) || 2));

  // Días seleccionables + política (paso calendario).
  const loadDays = useCallback(async () => {
    setLoadingDays(true);
    try {
      const res = await fetch(
        `${availabilityUrl}&locationId=${encodeURIComponent(locationId)}&guests=${party}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo cargar el calendario");
      setDays(data.days ?? []);
      setPolicy(data.policy ?? null);
      setDate((prev) => (prev && (data.days ?? []).includes(prev) ? prev : null));
    } catch (err) {
      swalError("No se pudo cargar el calendario", err instanceof Error ? err.message : undefined);
    } finally {
      setLoadingDays(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availabilityUrl, locationId, party]);

  useEffect(() => {
    void loadDays();
  }, [loadDays]);

  // Slots del día elegido.
  const loadSlots = useCallback(async () => {
    if (!date) return;
    setLoadingSlots(true);
    setSlotTables([]);
    try {
      const res = await fetch(
        `${availabilityUrl}&locationId=${encodeURIComponent(locationId)}&date=${date}&guests=${party}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo cargar el horario");
      setSlots(data.slots ?? []);
      setTime((prev) => (prev && (data.slots ?? []).some((s: SlotDetail) => s.time === prev) ? prev : null));
    } catch (err) {
      swalError("No se pudo cargar el horario", err instanceof Error ? err.message : undefined);
    } finally {
      setLoadingSlots(false);
    }
  }, [availabilityUrl, locationId, date, party]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  // Mesas del slot elegido (paso salas).
  const loadTables = useCallback(async () => {
    if (!date || !time) return;
    setLoadingTables(true);
    try {
      const res = await fetch(
        `${availabilityUrl}&locationId=${encodeURIComponent(locationId)}&date=${date}&time=${time}&guests=${party}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo cargar la sala");
      setSlotTables(data.tables ?? []);
      setTableId((prev) => {
        if (!prev) return null;
        const t = (data.tables ?? []).find((x: SlotTable) => x.id === prev);
        return t?.free ? prev : null;
      });
    } catch (err) {
      swalError("No se pudo cargar la sala", err instanceof Error ? err.message : undefined);
    } finally {
      setLoadingTables(false);
    }
  }, [availabilityUrl, locationId, date, time, party]);

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  const submit = async () => {
    if (!date || !time) {
      swalError("Elige fecha y hora");
      return;
    }
    if (name.trim().length < 2) {
      swalError("Ingresa el nombre del comensal");
      return;
    }
    setSubmitting(true);
    try {
      const startsAt = new Date(`${date}T${time}:00`);
      const table = slotTables.find((t) => t.id === tableId);
      const res = await fetch(createUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: startsAt.toISOString(),
          guests: party,
          name: name.trim(),
          phone: phone.trim() || null,
          notes: notes.trim() || null,
          locationId: locationId || null,
          roomId: table?.roomId ?? null,
          tableId: table?.id ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo reservar");
      swalToast(
        policy?.requireConfirmation
          ? "Solicitud enviada — el anfitrión la confirmará"
          : "¡Reservación confirmada!"
      );
      setDone({ table: table?.number ?? null, room: table?.roomName ?? null });
      onDone?.();
    } catch (err) {
      swalError("No se pudo reservar", err instanceof Error ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const roomGroups = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; tables: SlotTable[] }>();
    for (const t of slotTables) {
      const key = t.roomId ?? "_sin_sala";
      const g = groups.get(key) ?? { id: key, name: t.roomName ?? "Sin sala", tables: [] };
      g.tables.push(t);
      groups.set(key, g);
    }
    return [...groups.values()];
  }, [slotTables]);

  const selectedTable = slotTables.find((t) => t.id === tableId) ?? null;
  const selectedSlot = slots.find((s) => s.time === time) ?? null;

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-300/60 bg-emerald-50 p-6 text-center dark:border-emerald-500/30 dark:bg-emerald-500/10">
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-emerald-500 text-white">
          <CalendarCheck2 className="size-6" />
        </div>
        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
          {policy?.requireConfirmation ? "Solicitud enviada" : "¡Reservación confirmada!"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {date && new Date(`${date}T${time ?? "00:00"}:00`).toLocaleString("es-MX", {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          · {party} {party === 1 ? "persona" : "personas"}
          {done.table ? ` · Mesa ${done.table}` : done.room ? ` · ${done.room}` : ""}
        </p>
        <Button className="mt-4" variant="outline" onClick={() => setDone(null)}>
          Hacer otra reservación
        </Button>
      </div>
    );
  }

  const canNext =
    (step === 0 && !!locationId) ||
    (step === 1 && !!date && !!time) ||
    step === 2 || // la sala es opcional (asignación libre)
    (step === 3 && name.trim().length >= 2);

  return (
    <div className="space-y-4">
      {/* Indicador de pasos */}
      <div className="flex items-center gap-1.5">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 flex-col gap-1">
            <div
              className={cn(
                "h-1.5 rounded-full transition-colors",
                i < step ? "bg-primary" : i === step ? "bg-primary/60" : "bg-muted"
              )}
            />
            <span
              className={cn(
                "text-[10px] font-medium",
                i === step ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {i + 1}. {label}
            </span>
          </div>
        ))}
      </div>

      {/* Chips de política (se recuerdan durante todo el flujo) */}
      {policy && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <ScrollText className="size-3.5" />
          <span className="rounded-full border bg-muted/50 px-2 py-0.5">
            {policy.minNoticeMinutes >= 60
              ? `Reserva con ${Math.floor(policy.minNoticeMinutes / 60)} h de anticipación`
              : `Reserva con ${policy.minNoticeMinutes} min de anticipación`}
          </span>
          <span className="rounded-full border bg-muted/50 px-2 py-0.5">Máx. {policy.maxGuests} comensales</span>
          <span className="rounded-full border bg-muted/50 px-2 py-0.5">Mesa {policy.durationMinutes} min</span>
          {policy.notesText && (
            <span className="rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-primary">
              {policy.notesText}
            </span>
          )}
        </div>
      )}

      {/* PASO 0: Sucursal */}
      {step === 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">¿En qué sucursal reservas?</p>
          {locations.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLocationId(l.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
                locationId === l.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:bg-muted/50"
              )}
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MapPin className="size-4" />
              </span>
              <span className="flex-1 text-sm font-medium">{l.name}</span>
              {locationId === l.id && <Check className="size-4 text-primary" />}
            </button>
          ))}
        </div>
      )}

      {/* PASO 1: Calendario + hora + comensales */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Elige el día</p>
            <span className="ml-auto text-[11px] text-muted-foreground">
              Solo días con la sucursal abierta
            </span>
          </div>

          {/* Calendario mensual */}
          <div className="rounded-xl border p-3">
            <div className="mb-2 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() =>
                  setMonthCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
                }
              >
                <ChevronLeft className="size-4" />
              </Button>
              <p className="text-sm font-semibold capitalize">
                {cursor.toLocaleDateString("es-MX", { month: "long", year: "numeric" })}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() =>
                  setMonthCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
                }
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            {loadingDays ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <DayGrid
                cursor={cursor}
                days={days}
                selected={date}
                onSelect={(d) => {
                  setDate(d);
                  setTime(null);
                  setTableId(null);
                }}
              />
            )}
          </div>

          {/* Comensales */}
          <div className="flex items-center gap-3 rounded-xl border p-3">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Users className="size-4" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium">Asientos</p>
              <p className="text-[11px] text-muted-foreground">
                {policy && party > policy.maxGuests
                  ? `La política permite máximo ${policy.maxGuests}`
                  : "¿Cuántos comensales serán?"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="size-8 rounded-full p-0"
              onClick={() => setGuests(String(Math.max(1, party - 1)))}
              disabled={party <= 1}
            >
              <Minus className="size-3.5" />
            </Button>
            <span className="w-8 text-center text-sm font-bold tabular-nums">{party}</span>
            <Button
              variant="outline"
              size="sm"
              className="size-8 rounded-full p-0"
              onClick={() => setGuests(String(party + 1))}
              disabled={!!policy && party >= policy.maxGuests}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>

          {/* Horas del día */}
          {date && (
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Elige la hora</p>
                {selectedSlot && (
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {selectedSlot.rooms.reduce((a, r) => a + r.free, 0)} mesas libres a esa hora
                  </Badge>
                )}
              </div>
              {loadingSlots ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : slots.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                  No hay horarios disponibles ese día (revisa la anticipación mínima de la política).
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                  {slots.map((s) => {
                    const free = s.rooms.reduce((a, r) => a + r.free, 0);
                    const disabled = free === 0;
                    return (
                      <button
                        key={s.time}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          setTime(s.time);
                          setTableId(null);
                        }}
                        className={cn(
                          "rounded-lg border px-1 py-1.5 text-xs font-medium transition",
                          time === s.time
                            ? "border-primary bg-primary text-primary-foreground"
                            : disabled
                              ? "cursor-not-allowed border-border bg-muted/40 text-muted-foreground line-through"
                              : "border-border hover:border-primary/50 hover:bg-primary/5"
                        )}
                        title={disabled ? "Sin mesas libres a esta hora" : `${free} mesas libres`}
                      >
                        {s.time}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* PASO 2: Salas disponibles (plano) */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Armchair className="size-4 text-muted-foreground" />
            <p className="text-sm font-semibold">¿Dónde prefieren sentarse?</p>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {date && time
                ? `${new Date(`${date}T${time}:00`).toLocaleString("es-MX", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · ${party} pers.`
                : ""}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Las mesas bloqueadas no caben o ya están apartadas. Puedes continuar sin elegir mesa y el
            anfitrión te asignará la mejor opción.
          </p>
          {loadingTables ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : roomGroups.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No hay salas configuradas — la reservación se creará con asignación libre.
            </p>
          ) : (
            roomGroups.map((g) => (
              <div key={g.id}>
                <div className="mb-1.5 flex items-center gap-2">
                  <MapPin className="size-3.5 text-muted-foreground" />
                  <p className="text-sm font-semibold">{g.name}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {g.tables.filter((t) => t.free).length} disponibles
                  </Badge>
                </div>
                <div className="relative overflow-x-auto rounded-xl border bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] bg-[size:22px_22px] dark:bg-[linear-gradient(to_right,#ffffff10_1px,transparent_1px),linear-gradient(to_bottom,#ffffff10_1px,transparent_1px)]">
                  <div className="relative" style={{ height: 240, minWidth: 560 }}>
                    {g.tables.map((t, i) => (
                      <PlanTableElement
                        key={t.id}
                        table={t}
                        x={t.posX ?? 60 + (i % 4) * 130}
                        y={t.posY ?? 50 + Math.floor(i / 4) * 90}
                        className={cn(
                          t.free
                            ? tableId === t.id
                              ? "z-10 border-primary bg-primary/20 text-primary ring-2 ring-primary"
                              : "border-emerald-400 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "cursor-not-allowed border-slate-300 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-500"
                        )}
                        label={t.free ? `${t.capacity} pers.` : "No disponible"}
                        selected={tableId === t.id}
                        disabled={!t.free}
                        onClick={() => setTableId(t.free ? (tableId === t.id ? null : t.id) : null)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* PASO 3: Datos del comensal + resumen */}
      {step === 3 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold">Datos de la reservación</p>
          <InputGroupField
            label="Nombre del comensal"
            value={name}
            onChange={(e) => setName(e.target.value)}
            leftIcon={<Users className="size-4 text-slate-400" />}
          />
          <InputGroupField
            label="Teléfono (opcional)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            leftIcon={<span className="text-xs">📞</span>}
          />
          <InputGroupField
            label="Notas (opcional)"
            placeholder="Cumpleaños, silla para bebé…"
            value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 300))}
          />
          <div className="rounded-xl border bg-muted/30 p-3 text-sm">
            <p className="font-semibold">Resumen</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {locations.find((l) => l.id === locationId)?.name} ·{" "}
              {date &&
                new Date(`${date}T${time ?? "00:00"}:00`).toLocaleString("es-MX", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
              · {party} {party === 1 ? "persona" : "personas"}
              {selectedTable ? ` · Mesa ${selectedTable.number}` : " · mesa por asignar"}
            </p>
            {policy?.requireConfirmation && (
              <p className="mt-1 text-xs text-amber-600">
                El anfitrión confirmará la solicitud (política del local).
              </p>
            )}
          </div>
        </div>
      )}

      {/* Navegación */}
      <div className="flex items-center justify-between pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ChevronLeft className="size-4" />
          Atrás
        </Button>
        {step < STEPS.length - 1 ? (
          <Button size="sm" onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
            Continuar
            <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button size="sm" onClick={submit} disabled={submitting || !canNext}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <CalendarCheck2 className="size-4" />}
            {policy?.requireConfirmation ? "Enviar solicitud" : "Confirmar reservación"}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Cuadrícula mensual: solo los días en `days` son seleccionables. */
function DayGrid({
  cursor,
  days,
  selected,
  onSelect,
}: {
  cursor: Date;
  days: string[];
  selected: string | null;
  onSelect: (ymd: string) => void;
}) {
  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(y, m, i + 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }),
  ];

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
        {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((ymd, i) => {
          if (!ymd) return <span key={`e${i}`} />;
          const selectable = days.includes(ymd);
          const isSelected = selected === ymd;
          return (
            <button
              key={ymd}
              type="button"
              disabled={!selectable}
              onClick={() => onSelect(ymd)}
              className={cn(
                "aspect-square rounded-lg text-xs font-medium transition",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : selectable
                    ? "hover:bg-primary/10"
                    : "cursor-not-allowed text-muted-foreground/40 line-through"
              )}
              title={selectable ? "Disponible" : "Cerrado o fuera de política"}
            >
              {Number(ymd.slice(-2))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
