"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarRange,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  PackageX,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { BusinessModeBadge } from "@/components/shared/business-mode-badge";
import {
  ACTIVE,
  dayInPeriod,
  fmtDay,
  fmtMoney,
  monthTitle,
  type RentUnit,
  type ReservationsData,
  STATUS_META,
} from "./reservation-types";
import { ReservationCreateDialog, ReservationDetailDialog } from "./reservation-dialogs";

interface ReservationsAppProps {
  orgName: string;
  orgMode?: React.ComponentProps<typeof BusinessModeBadge>["mode"];
  canManage: boolean;
}

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

export function ReservationsApp({ orgName, orgMode, canManage }: ReservationsAppProps) {
  const [monthCursor, setMonthCursor] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [unitVariant, setUnitVariant] = useState<string>("");
  const [data, setData] = useState<ReservationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<ReservationsData["reservations"][number] | null>(null);
  const router = useRouter();

  const reload = useCallback(async (month: Date) => {
    const from = new Date(month.getFullYear(), month.getMonth(), 1);
    const to = new Date(from);
    to.setMonth(to.getMonth() + 1);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/reservaciones?from=${from.toISOString()}&to=${to.toISOString()}`
      );
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "No se pudieron cargar las reservaciones");
      setData({ reservations: json.reservations, units: json.units });
      setUnitVariant((prev) => prev || json.units?.[0]?.variantId || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las reservaciones");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload(monthCursor);
  }, [monthCursor, reload]);

  const unit = data?.units.find((u) => u.variantId === unitVariant) ?? null;
  const dayReservations = useMemo(() => {
    if (!data) return [];
    return data.reservations
      .filter((r) => dayInPeriod(selectedDay, r.startsAt, r.endsAt))
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [data, selectedDay]);

  const shiftDay = (delta: number) => {
    const d = new Date(selectedDay);
    d.setDate(d.getDate() + delta);
    setSelectedDay(d);
    setMonthCursor(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const shiftMonth = (delta: number) => {
    const m = new Date(monthCursor);
    m.setMonth(m.getMonth() + delta);
    const day = new Date(selectedDay);
    const dim = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    if (day.getDate() > dim) day.setDate(dim);
    day.setMonth(m.getMonth());
    setMonthCursor(m);
    setSelectedDay(day);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="safe-area-top sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-sidebar px-3 lg:px-4">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label="Volver al POS"
          onClick={() => {
            if (window.history.length > 1) {
              router.back();
            } else {
              router.push("/pos");
            }
          }}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
          <CalendarRange className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-heading text-base font-semibold leading-tight tracking-tight">Reservaciones</p>
            {orgMode ? (
              <BusinessModeBadge mode={orgMode} className="hidden shrink-0 sm:inline-flex" />
            ) : null}
          </div>
          <p className="truncate text-xs leading-tight text-muted-foreground">{orgName}</p>
        </div>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <NotificationsBell />
          <ThemeToggle />
          {canManage && (
            <Button size="sm" data-guide="reservation-new" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> <span className="hidden sm:inline">Nueva reservación</span>
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 content-start items-start gap-4 px-3 py-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:px-4">
        {/* Calendario de disponibilidad */}
        <section className="rounded-2xl border bg-card p-4" data-guide="reservation-availability">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-1.5 text-sm font-bold">
                <CalendarX2 className="size-4 text-info-ink" /> Disponibilidad
              </h2>
              <p className="text-xs text-muted-foreground">Unidades libres por día del artículo</p>
            </div>
            <Select value={unitVariant} onValueChange={setUnitVariant}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Elige artículo…" />
              </SelectTrigger>
              <SelectContent>
                {(data?.units ?? []).map((u) => (
                  <SelectItem key={u.variantId} value={u.variantId}>
                    {u.name} ({u.totalUnits} u)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => shiftMonth(-1)} aria-label="Mes anterior" className="size-11 desk:size-8">
              <ChevronLeft className="size-4" />
            </Button>
            <p className="text-sm font-semibold first-letter:uppercase">{monthTitle(monthCursor)}</p>
            <Button variant="ghost" size="sm" onClick={() => shiftMonth(1)} aria-label="Mes siguiente" className="size-11 desk:size-8">
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
            {WEEKDAYS.map((w, i) => (
              <span key={i} className="py-0.5">{w}</span>
            ))}
          </div>

          <AvailabilityGrid
            monthCursor={monthCursor}
            selectedDay={selectedDay}
            unit={unit}
            reservations={data?.reservations ?? []}
            onPickDay={(d) => {
              setSelectedDay(d);
              setMonthCursor(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
          />

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-success" /> Disponible
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-warning" /> Parcial
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-destructive" /> Agotado
            </span>
          </div>
        </section>

        {/* Reservaciones del día */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" onClick={() => shiftDay(-1)} aria-label="Día anterior">
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="ghost"
                className="min-w-40 font-semibold"
                onClick={() => {
                  const d = new Date();
                  d.setHours(0, 0, 0, 0);
                  setSelectedDay(d);
                  setMonthCursor(new Date(d.getFullYear(), d.getMonth(), 1));
                }}
              >
                <span className="inline-block first-letter:uppercase">{fmtDay(selectedDay)}</span>
              </Button>
              <Button variant="outline" size="icon" onClick={() => shiftDay(1)} aria-label="Día siguiente">
                <ChevronRight className="size-4" />
              </Button>
            </div>
            {unit && (
              <p className="text-xs text-muted-foreground">
                Disponibles hoy de <span className="font-semibold text-foreground">{unit.name}</span>:{" "}
                <span className="font-semibold text-foreground">
                  {availabilityOn(selectedDay, unit, data?.reservations ?? [])} / {unit.totalUnits} u
                </span>
              </p>
            )}
          </div>

          {loading && !data ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : error ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
              {error}
            </p>
          ) : (
            <div className="space-y-2">
              {dayReservations.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed p-8 text-center">
                  <CalendarX2 className="size-7 text-muted-foreground" />
                  <p className="text-sm font-medium">Sin reservaciones este día</p>
                  <p className="max-w-sm text-xs text-muted-foreground">
                    {canManage
                      ? "Usa «Nueva reservación» para apartar unidades de un artículo."
                      : "No hay rentas programadas para esta fecha."}
                  </p>
                  {canManage && (
                    <Button size="sm" onClick={() => setCreateOpen(true)}>
                      <Plus className="size-4" /> Nueva reservación
                    </Button>
                  )}
                </div>
              ) : (
                dayReservations.map((r) => {
                  const meta = STATUS_META[r.status];
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelected(r)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl border bg-card p-3 text-left transition hover:shadow",
                        meta.row
                      )}
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background text-sm font-bold">
                        {(r.customer?.fullName ?? "?")
                          .split(" ")
                          .map((w) => w[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-bold">{r.customer?.fullName ?? "Sin cliente"}</span>
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold", meta.chip)}>
                            <span className={cn("size-1.5 rounded-full", meta.dot)} />
                            {meta.label}
                          </span>
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {r.items.map((i) => `${i.name} ×${i.quantity}`).join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-bold">{fmtMoney(r.total)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {new Date(r.startsAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </section>
      </main>

      <ReservationCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        day={selectedDay}
        units={data?.units ?? []}
        onCreated={() => void reload(monthCursor)}
      />
      <ReservationDetailDialog
        reservation={selected}
        canManage={canManage}
        onOpenChange={(o) => !o && setSelected(null)}
        onChanged={() => void reload(monthCursor)}
      />
    </div>
  );
}

// ── Rejilla mensual de disponibilidad ────────────────────────────────────────

interface AvailabilityGridProps {
  monthCursor: Date;
  selectedDay: Date;
  unit: RentUnit | null;
  reservations: ReservationsData["reservations"];
  onPickDay: (day: Date) => void;
}

function AvailabilityGrid({ monthCursor, selectedDay, unit, reservations, onPickDay }: AvailabilityGridProps) {
  const cells = useMemo(() => {
    const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // lunes = 0
    const start = new Date(first);
    start.setDate(1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [monthCursor]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="grid grid-cols-7 gap-1">
      {cells.map((day, i) => {
        const inMonth = day.getMonth() === monthCursor.getMonth();
        const past = day < today;
        const selected = day.toDateString() === selectedDay.toDateString();
        let available: number | null = null;
        if (unit && inMonth) available = availabilityOn(day, unit, reservations);
        return (
          <button
            key={i}
            type="button"
            onClick={() => onPickDay(day)}
            disabled={!inMonth || (past && !unit)}
            title={
              inMonth && unit
                ? past
                  ? "Día pasado"
                  : `${available} de ${unit.totalUnits} disponibles · ${
                      unit.totalUnits - (available ?? 0)
                    } apartadas`
                : inMonth
                  ? "Elige un artículo para ver disponibilidad"
                  : ""
            }
            className={cn(
              "flex h-14 flex-col items-center justify-center rounded-xl border text-xs transition-colors desk:h-12",
              !inMonth && "pointer-events-none border-transparent",
              inMonth && !past && "cursor-pointer hover:border-primary/60 hover:bg-primary/5",
              inMonth && past && "cursor-default border-transparent bg-muted/30 text-muted-foreground/60",
              selected && "border-primary bg-primary/10 ring-1 ring-primary"
            )}
          >
            <span className={cn("text-sm font-semibold tabular", selected && "text-primary")}>{day.getDate()}</span>
            {inMonth && unit && (
              <span
                className={cn(
                  "mt-0.5 rounded-full px-1.5 text-xs font-semibold leading-4 tabular",
                  past
                    ? "bg-muted text-muted-foreground/50"
                    : available === 0
                      ? "bg-destructive/20 text-destructive"
                      : available !== null && available < unit.totalUnits
                        ? "bg-warning/20 text-warning-ink"
                        : "bg-success/20 text-success-ink"
                )}
              >
                {available}
              </span>
            )}
            {inMonth && !unit && <PackageX className="mt-0.5 size-3 text-muted-foreground/50" />}
          </button>
        );
      })}
    </div>
  );
}

/** Unidades libres de la unidad en el día (reservaciones activas). */
function availabilityOn(
  day: Date,
  unit: RentUnit,
  reservations: ReservationsData["reservations"]
): number {
  const booked = reservations
    .filter((r) => ACTIVE.includes(r.status) && dayInPeriod(day, r.startsAt, r.endsAt))
    .reduce(
      (acc, r) =>
        acc +
        r.items
          .filter((i) => i.variantId === unit.variantId)
          .reduce((a, i) => a + i.quantity, 0),
      0
    );
  return Math.max(0, unit.totalUnits - booked);
}
