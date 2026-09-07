"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Armchair, CalendarCheck2, Clock, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { swalError, swalToast } from "@/lib/swal";
import { ReservationFloorPlan, type PlanTable } from "@/components/portal/reservation-floor-plan";

// Reservación de mesa desde el portal: el cliente elige fecha, hora y
// comensales y ve el plano del local por sala (forma + asientos de cada mesa)
// para pedir una mesa concreta — o sin mesa, y el anfitrión la asigna.

interface Room {
  id: string;
  name: string;
  tables: PlanTable[];
}

interface MyReservation {
  id: string;
  guests: number;
  startsAt: string;
  status: string;
  notes: string | null;
  room: { id: string; name: string } | null;
  table: { id: string; number: number } | null;
}

interface WaitlistEntry {
  id: string;
  guests: number;
  status: "waiting" | "available";
  position: number;
  availableAt: string | null;
  availableTable: { id: string; number: number; name: string | null; capacity: number; room: { name: string } | null } | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  seated: "Sentada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReservationBooking() {
  const [date, setDate] = useState(() => {
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const [time, setTime] = useState("13:00");
  const [guests, setGuests] = useState("2");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loose, setLoose] = useState<PlanTable[]>([]);
  const [takenIds, setTakenIds] = useState<string[]>([]);
  const [mine, setMine] = useState<MyReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Lista de espera: entrada activa del cliente + acciones.
  const [waitlist, setWaitlist] = useState<WaitlistEntry | null>(null);
  const [waitlistBusy, setWaitlistBusy] = useState(false);
  const waitlistRef = useRef<WaitlistEntry | null>(null);
  waitlistRef.current = waitlist;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/reservations?date=${date}&guests=${Number(guests) || 2}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) throw new Error(data.error || "No se pudo cargar");
      setRooms(data.rooms ?? []);
      setLoose(data.looseTables ?? []);
      setTakenIds(data.takenTableIds ?? []);
      setMine(data.myReservations ?? []);
      setSelectedTable((prev) =>
        prev && !(data.takenTableIds ?? []).includes(prev) ? prev : null
      );
    } catch (err) {
      swalError("No se pudo cargar", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, [date, guests]);

  const loadWaitlist = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/waitlist?guests=${Number(guests) || 2}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) return;
      const prev = waitlistRef.current;
      const next: WaitlistEntry | null = data.entry ?? null;
      setWaitlist(next);
      // Aviso en vivo: transición waiting → available (llega por poll).
      if (prev?.status === "waiting" && next?.status === "available" && next.availableTable) {
        swalToast(`¡Mesa #${next.availableTable.number} disponible para tu grupo!`);
      }
    } catch {
      /* noop: la sección se queda con lo último que tenga */
    }
  }, [guests]);

  useEffect(() => {
    void load();
    void loadWaitlist();
  }, [load, loadWaitlist]);

  // Poll en vivo (20 s): mientras esté en espera, vigilar que se libere una mesa.
  useEffect(() => {
    if (!waitlist || waitlist.status !== "waiting") return;
    const timer = setInterval(() => {
      void loadWaitlist();
    }, 20000);
    return () => clearInterval(timer);
  }, [waitlist?.id, waitlist?.status, loadWaitlist]);

  const enrollWaitlist = async () => {
    setWaitlistBusy(true);
    try {
      const res = await fetch("/api/portal/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guests: Number(guests) || 2 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo anotar");
      setWaitlist(data.entry ?? null);
      swalToast("Estás en la lista de espera — te avisaremos al liberarse una mesa");
      void load();
    } catch (err) {
      swalError("No se pudo anotar", err instanceof Error ? err.message : undefined);
    } finally {
      setWaitlistBusy(false);
    }
  };

  const cancelWaitlist = async () => {
    setWaitlistBusy(true);
    try {
      await fetch("/api/portal/waitlist", { method: "DELETE" });
      setWaitlist(null);
      swalToast("Saliste de la lista de espera");
    } catch {
      swalError("No se pudo salir de la lista");
    } finally {
      setWaitlistBusy(false);
    }
  };

  const claimWaitlist = async () => {
    setWaitlistBusy(true);
    try {
      const res = await fetch("/api/portal/waitlist/claim", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo confirmar");
      swalToast("Mesa confirmada — el anfitrión te espera");
      setWaitlist(null);
      void load();
    } catch (err) {
      swalError("No se pudo confirmar", err instanceof Error ? err.message : undefined);
      setWaitlist(null);
      void loadWaitlist();
    } finally {
      setWaitlistBusy(false);
    }
  };

  const available = useMemo(() => {
    const party = Number(guests) || 2;
    const ok = (t: PlanTable) =>
      t.status !== "occupied" && !takenIds.includes(t.id) && t.capacity >= party;
    return { rooms, loose: loose.filter(ok), party };
  }, [rooms, loose, takenIds, guests]);

  const submit = async () => {
    if (!date || !time) {
      swalError("Elige fecha y hora");
      return;
    }
    setSubmitting(true);
    try {
      const startsAt = new Date(`${date}T${time}:00`);
      const table = [...rooms.flatMap((r) => r.tables), ...loose].find((t) => t.id === selectedTable);
      const res = await fetch("/api/portal/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: startsAt.toISOString(),
          guests: Number(guests) || 2,
          roomId: table
            ? rooms.find((r) => r.tables.some((t) => t.id === table.id))?.id ?? null
            : null,
          tableId: table?.id ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo reservar");
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

  /** Mini-plano de una sala: reutiliza el renderizador compartido. */
  const miniPlan = (tables: PlanTable[]) => (
    <ReservationFloorPlan
      tables={tables}
      party={available.party}
      takenIds={takenIds}
      selectedId={selectedTable}
      onSelect={setSelectedTable}
    />
  );

  return (
    <div className="space-y-5 p-4">
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
                {room.tables.length > 0 ? miniPlan(room.tables) : (
                  <p className="text-xs text-muted-foreground">Sin mesas en esta sala.</p>
                )}
              </div>
            ))}
            {available.loose.length > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-semibold">Otras mesas</p>
                {miniPlan(available.loose)}
              </div>
            )}
            {available.rooms.length === 0 && available.loose.length === 0 && (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No hay mesas configuradas para reservar.
              </p>
            )}
          </div>

          <Button className="w-full h-11" onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <CalendarCheck2 className="size-4" />}
            {selectedTable ? "Solicitar esta mesa" : "Solicitar mesa (asignación libre)"}
          </Button>

          {/* Lista de espera: anotarse y recibir aviso en vivo cuando se libera una mesa */}
          <div className="rounded-xl border bg-muted/30 p-3.5">
            {waitlist ? (
              waitlist.status === "available" && waitlist.availableTable ? (
                <div className="space-y-2.5">
                  <div className="flex items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
                      <Armchair className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        ¡Mesa #{waitlist.availableTable.number} disponible!
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {waitlist.availableTable.room?.name ?? "Sin sala"} · hasta{" "}
                        {waitlist.availableTable.capacity} personas — confirma para reservarla
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1 h-10" onClick={claimWaitlist} disabled={waitlistBusy}>
                      {waitlistBusy ? <Loader2 className="size-4 animate-spin" /> : <CalendarCheck2 className="size-4" />}
                      Confirmar mesa
                    </Button>
                    <Button variant="outline" className="h-10" onClick={cancelWaitlist} disabled={waitlistBusy}>
                      Dejar pasar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
                    <Loader2 className="size-4 animate-spin" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      En espera · posición #{waitlist.position + 1}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {waitlist.guests} {waitlist.guests === 1 ? "persona" : "personas"} — te avisamos en vivo
                      cuando se libere una mesa que te quepa.
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={cancelWaitlist} disabled={waitlistBusy}>
                    Salir
                  </Button>
                </div>
              )
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Clock className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">¿No encuentras mesa?</p>
                  <p className="text-xs text-muted-foreground">
                    Anótate y te avisamos al instante cuando se libere una para {Number(guests) || 2}{" "}
                    {Number(guests) === 1 ? "persona" : "personas"}.
                  </p>
                </div>
                <Button size="sm" variant="outline" className="h-8 shrink-0 text-xs" onClick={enrollWaitlist} disabled={waitlistBusy}>
                  {waitlistBusy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Apuntarme
                </Button>
              </div>
            )}
          </div>

          {/* Mis reservaciones */}
          {mine.length > 0 && (
            <div className="space-y-2 border-t pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Mis reservaciones
              </p>
              {mine.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border bg-muted/30 px-3 py-2 text-sm">
                  <Armchair className="size-4 text-primary" />
                  <span className="font-medium">
                    {fmtDate(r.startsAt)} · {r.guests} {r.guests === 1 ? "persona" : "personas"}
                    {r.table ? ` · Mesa ${r.table.number}` : ""}
                    {r.room && !r.table ? ` · ${r.room.name}` : ""}
                  </span>
                  <Badge variant="outline" className="ml-auto">
                    {STATUS_LABEL[r.status] ?? r.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}