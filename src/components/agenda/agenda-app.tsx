"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Scissors,
  UsersRound,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogComponent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { BusinessModeBadge } from "@/components/shared/business-mode-badge";
import {
  type AgendaCita,
  type AgendaData,
  type AgendaStaff,
  dayRange,
  DAY_END_HOUR,
  DAY_START_HOUR,
  fmtDay,
  fmtMoney,
  fmtTime,
  minutesOfDay,
  ROW_HEIGHT,
  SLOT_MIN,
  snapToSlot,
  STATUS_META,
} from "./agenda-types";
import { CitaCreateDialog, CitaDetailDialog } from "./cita-dialogs";

const TOTAL_MIN = (DAY_END_HOUR - DAY_START_HOUR) * 60;
const GRID_HEIGHT = (TOTAL_MIN / SLOT_MIN) * ROW_HEIGHT;

interface AgendaAppProps {
  orgName: string;
  orgMode?: React.ComponentProps<typeof BusinessModeBadge>["mode"];
  canManage: boolean;
}

type Tab = "agenda" | "staff";

export function AgendaApp({ orgName, orgMode, canManage }: AgendaAppProps) {
  const [tab, setTab] = useState<Tab>("agenda");
  const [day, setDay] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [data, setData] = useState<AgendaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSlot, setCreateSlot] = useState<{ employeeId: string | null; time: string }>({
    employeeId: null,
    time: "10:00",
  });
  const [selected, setSelected] = useState<AgendaCita | null>(null);

  const reload = useCallback(async (target: Date = day) => {
    const { from, to } = dayRange(target);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/agenda?from=${from.toISOString()}&to=${to.toISOString()}`
      );
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "No se pudo cargar la agenda");
      setData({ appointments: json.appointments, staff: json.staff, services: json.services });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la agenda");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [day]);

  useEffect(() => {
    void reload(day);
  }, [day, reload]);

  const shift = (delta: number) => {
    const d = new Date(day);
    d.setDate(d.getDate() + delta);
    setDay(d);
  };

  const openSlot = (employeeId: string, minutes: number) => {
    const d = new Date(day);
    d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    const snap = snapToSlot(d);
    const hh = String(snap.getHours()).padStart(2, "0");
    const mm = String(snap.getMinutes()).padStart(2, "0");
    setCreateSlot({ employeeId, time: `${hh}:${mm}` });
    setCreateOpen(true);
  };

  const openBlock = (cita: AgendaCita) => setSelected(cita);

  const chips = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of data?.appointments ?? []) {
      counts[a.status] = (counts[a.status] ?? 0) + 1;
    }
    return (Object.keys(STATUS_META) as (keyof typeof STATUS_META)[])
      .filter((k) => counts[k])
      .map((k) => ({ status: k, count: counts[k] }));
  }, [data?.appointments]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      {/* Encabezado */}
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-card/85 px-3 backdrop-blur lg:px-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0" aria-label="Volver al POS">
          <Link href="/pos">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <span className="flex size-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
          <CalendarDays className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-bold leading-tight">Agenda de citas</p>
            {orgMode ? (
              <BusinessModeBadge mode={orgMode} className="hidden shrink-0 sm:inline-flex" />
            ) : null}
          </div>
          <p className="truncate text-[11px] leading-tight text-muted-foreground">{orgName}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {canManage && (
            <Button size="sm" onClick={() => { setCreateSlot({ employeeId: null, time: "10:00" }); setCreateOpen(true); }}>
              <Plus className="size-4" /> <span className="hidden sm:inline">Nueva cita</span>
            </Button>
          )}
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mx-auto w-full max-w-6xl flex-1 px-3 py-4 lg:px-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="agenda">
              <CalendarDays className="size-4" /> Agenda
            </TabsTrigger>
            {canManage && (
              <TabsTrigger value="staff">
                <UsersRound className="size-4" /> Personal y servicios
              </TabsTrigger>
            )}
          </TabsList>

          {tab === "agenda" && (
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={() => shift(-1)} aria-label="Día anterior">
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" className="capitalize" onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setDay(d); }}>
                {fmtDay(day)}
              </Button>
              <Button variant="outline" size="sm" onClick={() => shift(1)} aria-label="Día siguiente">
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>

        <TabsContent value="agenda" className="mt-0">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={c.status}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                  STATUS_META[c.status as keyof typeof STATUS_META].chip
                )}
              >
                <span className={cn("size-1.5 rounded-full", STATUS_META[c.status as keyof typeof STATUS_META].dot)} />
                {STATUS_META[c.status as keyof typeof STATUS_META].label}: {c.count}
              </span>
            ))}
            {data?.staff.length === 0 && (
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                Sin personal con servicios asignados
              </span>
            )}
          </div>

          {error && (
            <p className="mb-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          {loading && !data ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : (
            <DayGrid
              day={day}
              data={data}
              canManage={canManage}
              onSlotClick={openSlot}
              onBlockClick={openBlock}
            />
          )}

          {canManage && data?.staff.length === 0 && !loading && (
            <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed p-8 text-center">
              <Scissors className="size-8 text-muted-foreground" />
              <p className="font-semibold">Aún no hay personal con servicios</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Asigna qué servicios presta cada miembro de tu equipo (y cuánto dura cada uno) en la
                pestaña «Personal y servicios». Sin asignaciones no se pueden agendar citas.
              </p>
              <Button size="sm" onClick={() => setTab("staff")}>
                <Wrench className="size-4" /> Asignar servicios
              </Button>
            </div>
          )}
        </TabsContent>

        {canManage && (
          <TabsContent value="staff" className="mt-0">
            <StaffAssignment
              staff={data?.staff ?? []}
              services={data?.services ?? []}
              canManage={canManage}
              onChanged={() => void reload(day)}
            />
          </TabsContent>
        )}
      </Tabs>

      <CitaCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        day={day}
        defaultEmployeeId={createSlot.employeeId}
        defaultTime={createSlot.time}
        staff={data?.staff ?? []}
        onCreated={() => void reload()}
      />
      <CitaDetailDialog
        cita={selected}
        canManage={canManage}
        onOpenChange={(o) => !o && setSelected(null)}
        onChanged={() => void reload()}
      />
    </div>
  );
}

// ── Rejilla del día ──────────────────────────────────────────────────────────

interface DayGridProps {
  day: Date;
  data: AgendaData | null;
  canManage: boolean;
  onSlotClick: (employeeId: string, minutes: number) => void;
  onBlockClick: (cita: AgendaCita) => void;
}

function DayGrid({ day, data, canManage, onSlotClick, onBlockClick }: DayGridProps) {
  const staff = data?.staff ?? [];
  const today = useMemo(() => {
    const now = new Date();
    return (
      now.getFullYear() === day.getFullYear() &&
      now.getMonth() === day.getMonth() &&
      now.getDate() === day.getDate()
    );
  }, [day]);
  const nowLine = useMemo(() => {
    if (!today) return null;
    const mins = minutesOfDay(new Date());
    if (mins < DAY_START_HOUR * 60 || mins > DAY_END_HOUR * 60) return null;
    return (mins - DAY_START_HOUR * 60) / SLOT_MIN * ROW_HEIGHT + ROW_HEIGHT / 2;
  }, [today]);

  if (staff.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
        No hay agenda para mostrar este día.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <div className="min-w-max">
        {/* Columnas */}
        <div className="grid border-b" style={{ gridTemplateColumns: `56px repeat(${staff.length}, minmax(220px, 1fr))` }}>
          <div className="sticky left-0 z-10 bg-card px-2 py-2 text-xs font-semibold text-muted-foreground" />
          {staff.map((s) => (
            <div key={s.id} className="border-l bg-muted/30 px-3 py-2">
              <p className="truncate text-sm font-bold">{s.fullName}</p>
              <p className="truncate text-[11px] text-muted-foreground">{s.position ?? "Personal"}</p>
            </div>
          ))}
        </div>

        {/* Cuerpo */}
        <div className="grid" style={{ gridTemplateColumns: `56px repeat(${staff.length}, minmax(220px, 1fr))` }}>
          {/* Eje de tiempo */}
          <div className="relative border-r bg-card" style={{ height: GRID_HEIGHT }}>
            {Array.from({ length: TOTAL_MIN / SLOT_MIN }).map((_, i) => {
              const minutes = DAY_START_HOUR * 60 + i * SLOT_MIN;
              const h = Math.floor(minutes / 60);
              return (
                <div
                  key={i}
                  className="absolute right-1 text-[10px] font-medium text-muted-foreground"
                  style={{ top: i * ROW_HEIGHT - 6 }}
                >
                  {String(h).padStart(2, "0")}:00
                </div>
              );
            })}
            {nowLine !== null && (
              <div className="absolute right-0 left-0 z-10 border-t-2 border-destructive/70">
                <span className="absolute -left-1 -top-1 size-2 rounded-full bg-destructive" />
              </div>
            )}
          </div>

          {/* Columnas por personal */}
          {staff.map((s) => (
            <div key={s.id} className="relative border-l" style={{ height: GRID_HEIGHT }}>
              {/* Líneas de 30 min */}
              {Array.from({ length: TOTAL_MIN / SLOT_MIN + 1 }).map((_, i) => (
                <div
                  key={i}
                  className={cn("absolute inset-x-0 border-t", i % 2 === 0 ? "border-border" : "border-border/40")}
                  style={{ top: i * ROW_HEIGHT }}
                />
              ))}
              {/* Hora actual */}
              {nowLine !== null && (
                <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-destructive/70" style={{ top: nowLine }} />
              )}

              {/* Celdas clicables (bloques de 30 min) */}
              {Array.from({ length: TOTAL_MIN / SLOT_MIN }).map((_, i) => {
                const slotStart = DAY_START_HOUR * 60 + i * SLOT_MIN;
                const rowStart = i * ROW_HEIGHT;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!canManage}
                    aria-label={`Agendar a las ${String(Math.floor(slotStart / 60)).padStart(2, "0")}:${String(slotStart % 60).padStart(2, "0")}`}
                    onClick={() => onSlotClick(s.id, slotStart)}
                    className={cn(
                      "absolute inset-x-0 z-0 rounded-sm",
                      canManage && "transition hover:bg-primary/5",
                      i % 2 === 0 ? "bg-transparent" : "bg-muted/10"
                    )}
                    style={{ top: rowStart, height: ROW_HEIGHT }}
                  />
                );
              })}

              {/* Citas */}
              {(data?.appointments ?? [])
                .filter((a) => a.employee.id === s.id)
                .map((a) => {
                  const start = new Date(a.startsAt);
                  const top = (minutesOfDay(start) - DAY_START_HOUR * 60) / SLOT_MIN * ROW_HEIGHT + 1;
                  const height = Math.max(ROW_HEIGHT - 4, (a.durationMin / SLOT_MIN) * ROW_HEIGHT - 4);
                  const meta = STATUS_META[a.status];
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onBlockClick(a)}
                      className={cn(
                        "absolute inset-x-1 z-20 overflow-hidden rounded-lg border px-2 py-1 text-left shadow-sm transition hover:shadow",
                        meta.block,
                        a.status === "cancelled" && "opacity-60"
                      )}
                      style={{ top, height }}
                      title={`${a.customer?.fullName ?? "Sin cliente"} · ${a.service.name}`}
                    >
                      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                        <span className={cn("size-1.5 shrink-0 rounded-full", meta.dot)} />
                        {fmtTime(a.startsAt)} · {meta.label}
                      </p>
                      <p className="truncate text-xs font-bold leading-tight">
                        {a.customer?.fullName ?? "Sin cliente"}
                      </p>
                      {height > ROW_HEIGHT + 8 && (
                        <p className="truncate text-[11px] leading-tight opacity-85">{a.service.name}</p>
                      )}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Personal y servicios (asignación) ───────────────────────────────────────

interface StaffAssignmentProps {
  staff: AgendaStaff[];
  services: AgendaData["services"];
  canManage: boolean;
  onChanged: () => void;
}

function StaffAssignment({ staff, services, canManage, onChanged }: StaffAssignmentProps) {
  const [editing, setEditing] = useState<AgendaStaff | null>(null);

  return (
    <div className="space-y-3">
      {staff.length === 0 && (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">No hay asignaciones todavía</p>
          <p className="mt-1">
            Los empleados aparecen aquí cuando tienen al menos un servicio asignado.
          </p>
        </div>
      )}
      {staff.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
            {s.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">{s.fullName}</p>
            <p className="text-xs text-muted-foreground">{s.position ?? "Personal"}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {s.services.map((sv) => (
                <span
                  key={sv.variantId}
                  className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                >
                  {sv.name} · {sv.durationMin} min
                  {!sv.isActive && " · inactivo"}
                </span>
              ))}
            </div>
          </div>
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setEditing(s)}>
              <Pencil className="size-3.5" /> Editar servicios
            </Button>
          )}
        </div>
      ))}

      <p className="text-xs text-muted-foreground">
        Los empleados que no aparecen aquí son de nómina u operación y no prestan servicios
        agendables; asígnales servicios desde el módulo de Empleados si aplica.
      </p>

      {editing && (
        <AssignmentDialog
          employee={editing}
          services={services}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function AssignmentDialog({
  employee,
  services,
  onClose,
  onSaved,
}: {
  employee: AgendaStaff;
  services: AgendaData["services"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Record<string, { on: boolean; durationMin: number }>>(() => {
    const initial: Record<string, { on: boolean; durationMin: number }> = {};
    for (const sv of services) initial[sv.variantId] = { on: false, durationMin: 30 };
    for (const sv of employee.services) {
      initial[sv.variantId] = { on: sv.isActive, durationMin: sv.durationMin };
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCount = Object.values(rows).filter((r) => r.on).length;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const assignments = Object.entries(rows)
        .filter(([, r]) => r.on)
        .map(([variantId, r]) => ({
          employeeId: employee.id,
          variantId,
          durationMin: r.durationMin,
          isActive: true,
        }));
      const res = await fetch("/api/agenda/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo guardar");
      toast.success("Servicios actualizados");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogComponent
      open
      onOpenChange={(o) => !o && onClose()}
      icon={<Scissors className="size-5 text-primary" />}
      title={`Servicios de ${employee.fullName}`}
      description="Marca los servicios que presta y su duración. Solo se pueden agendar servicios con inventario desactivado."
      className="sm:max-w-xl"
      bodyClassName="space-y-3"
      footer={
        <>
          {error && <p className="mr-auto text-sm font-medium text-destructive">{error}</p>}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Guardar ({activeCount})
          </Button>
        </>
      }
    >
      <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
        {services.length === 0 && (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No hay servicios en el catálogo. Crea productos sin inventario en Catálogos → Productos.
          </p>
        )}
        {services.map((sv) => {
          const row = rows[sv.variantId];
          return (
            <div key={sv.variantId} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2">
              <Switch
                checked={row?.on ?? false}
                onCheckedChange={(on) =>
                  setRows((prev) => ({ ...prev, [sv.variantId]: { on, durationMin: prev[sv.variantId]?.durationMin ?? 30 } }))
                }
                aria-label={`Activar ${sv.name}`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{sv.name}</p>
                <p className="text-xs text-muted-foreground">{fmtMoney(sv.price)}</p>
              </div>
              <div className="flex w-28 items-center gap-1.5">
                <Input
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  value={row?.durationMin ?? 30}
                  disabled={!row?.on}
                  onChange={(e) =>
                    setRows((prev) => ({
                      ...prev,
                      [sv.variantId]: { on: prev[sv.variantId]?.on ?? false, durationMin: Number(e.target.value) || 30 },
                    }))
                  }
                  className="h-8 text-center text-xs"
                />
                <span className="text-[10px] text-muted-foreground">min</span>
              </div>
            </div>
          );
        })}
      </div>
    </DialogComponent>
  );
}