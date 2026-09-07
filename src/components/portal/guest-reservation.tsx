"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Armchair, CalendarCheck2, Loader2, MapPin, User, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { swalError, swalToast } from "@/lib/swal";
import { ReservationFloorPlan, type PlanTable } from "@/components/portal/reservation-floor-plan";

// Reservación de mesa SIN cuenta: nombre y teléfono bastan. La organización se
// resuelve en el servidor desde `?org=` o desde el QR de mesa (`?table=&token=`),
// así que el componente solo propaga esos parámetros a la API pública.

interface Room {
  id: string;
  name: string;
  tables: PlanTable[];
}

export function GuestReservation({
  orgId,
  tableId,
  tableToken,
}: {
  orgId?: string;
  tableId?: string;
  tableToken?: string;
}) {
  const [date, setDate] = useState(() => {
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const [time, setTime] = useState("13:00");
  const [guests, setGuests] = useState("2");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loose, setLoose] = useState<PlanTable[]>([]);
  const [takenIds, setTakenIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{
    table: { id: string; number: number } | null;
    room: { id: string; name: string } | null;
    guests: number;
    startsAt: string;
    status: string;
  } | null>(null);

  const params = new URLSearchParams();
  if (orgId) params.set("org", orgId);
  if (tableId) {
    params.set("table", tableId);
    if (tableToken) params.set("token", tableToken);
  }
  const orgQuery = params.toString();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/public/reservations?${orgQuery}&date=${date}&guests=${Number(guests) || 2}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo cargar");
      setRooms(data.rooms ?? []);
      setLoose(data.looseTables ?? []);
      setTakenIds(data.takenTableIds ?? []);
      setSelectedTable((prev) =>
        prev && !(data.takenTableIds ?? []).includes(prev) ? prev : null
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "No se pudo cargar");
      swalError("No se pudo cargar", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [orgQuery, date, guests]);

  useEffect(() => {
    void load();
  }, [load]);

  const available = useMemo(() => {
    const party = Number(guests) || 2;
    const ok = (t: PlanTable) =>
      t.status !== "occupied" && !takenIds.includes(t.id) && t.capacity >= party;
    return { rooms, loose: loose.filter(ok), party };
  }, [rooms, loose, takenIds, guests]);

  const submit = async () => {
    if (name.trim().length < 2) {
      swalError("Ingresa tu nombre");
      return;
    }
    if (phone.trim().length < 7) {
      swalError("Ingresa un teléfono válido");
      return;
    }
    if (!date || !time) {
      swalError("Elige fecha y hora");
      return;
    }
    setSubmitting(true);
    try {
      const startsAt = new Date(`${date}T${time}:00`);
      const table = [...rooms.flatMap((r) => r.tables), ...loose].find((t) => t.id === selectedTable);
      const res = await fetch(`/api/public/reservations?${orgQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: startsAt.toISOString(),
          guests: Number(guests) || 2,
          name: name.trim(),
          phone: phone.trim(),
          roomId: table
            ? rooms.find((r) => r.tables.some((t) => t.id === table.id))?.id ?? null
            : null,
          tableId: table?.id ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo reservar");
      setDone(data.reservation ?? null);
      swalToast(
        table
          ? `Solicitaste la mesa #${table.number} — la confirmará el anfitrión`
          : "Solicitud enviada — el anfitrión asignará mesa"
      );
      setSelectedTable(null);
      void load();
    } catch (err) {
      swalError("No se pudo reservar", err instanceof Error ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-300/60 bg-emerald-50 p-5 text-center dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-emerald-500 text-white">
            <CalendarCheck2 className="size-6" />
          </div>
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
            ¡Solicitud enviada, {done.guests === 1 ? "comensal" : "comensales"}!
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(done.startsAt).toLocaleString("es-MX", {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            · {done.guests} {done.guests === 1 ? "persona" : "personas"}
            {done.table ? ` · Mesa ${done.table.number}` : done.room ? ` · ${done.room.name}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            El anfitrión confirmará tu mesa — lleguen unos minutos antes.
          </p>
          <Button className="mt-4" variant="outline" onClick={() => setDone(null)}>
            Hacer otra reservación
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Datos del comensal: nombre y teléfono bastan, sin cuenta. */}
      <div className="rounded-2xl border bg-muted/30 p-3.5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tus datos (sin cuenta)
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              className="h-11 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm"
            />
          </div>
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Teléfono (para confirmarte)"
              inputMode="tel"
              className="h-11 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Selectores */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Fecha</label>
          <input
            type="date"
            value={date}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Hora</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Comensales</label>
          <input
            type="number"
            min={1}
            max={50}
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-2 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : loadError ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {loadError}
        </p>
      ) : (
        <>
          {/* Plano por sala */}
          <div className="space-y-4">
            {available.rooms.map((room) => (
              <div key={room.id}>
                <div className="mb-1.5 flex items-center gap-2">
                  <MapPin className="size-3.5 text-muted-foreground" />
                  <p className="text-sm font-semibold">{room.name}</p>
                  <Badge variant="outline" className="text-[10px]">
                    {room.tables.filter((t) => !takenIds.includes(t.id) && t.status !== "occupied" && t.capacity >= available.party).length} disponibles
                  </Badge>
                </div>
                {room.tables.length > 0 ? (
                  <ReservationFloorPlan
                    tables={room.tables}
                    party={available.party}
                    takenIds={takenIds}
                    selectedId={selectedTable}
                    onSelect={setSelectedTable}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">Sin mesas en esta sala.</p>
                )}
              </div>
            ))}
            {available.loose.length > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-semibold">Otras mesas</p>
                <ReservationFloorPlan
                  tables={available.loose}
                  party={available.party}
                  takenIds={takenIds}
                  selectedId={selectedTable}
                  onSelect={setSelectedTable}
                />
              </div>
            )}
            {available.rooms.length === 0 && available.loose.length === 0 && (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No hay mesas configuradas para reservar.
              </p>
            )}
          </div>

          <Button className="h-11 w-full" onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Armchair className="size-4" />}
            {selectedTable ? "Solicitar esta mesa" : "Solicitar mesa (asignación libre)"}
          </Button>
        </>
      )}
    </div>
  );
}