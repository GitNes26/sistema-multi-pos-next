"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Armchair, CalendarCheck2, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { swalError, swalToast } from "@/lib/swal";
import { ReservationWizard } from "@/components/reservations/reservation-wizard";

// Reservación de mesa desde el portal: wizard a pasos (sucursal → calendario
// según políticas → hora/asientos → sala en el plano → datos). La lista de
// espera y "mis reservaciones" se mantienen alrededor del wizard.

interface LocationRow {
  id: string;
  name: string;
}

interface MyReservation {
  id: string;
  guests: number;
  startsAt: string;
  status: string;
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
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [mine, setMine] = useState<MyReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  // Lista de espera: entrada activa del cliente + acciones.
  const [waitlist, setWaitlist] = useState<WaitlistEntry | null>(null);
  const [waitlistBusy, setWaitlistBusy] = useState(false);
  const waitlistRef = useRef<WaitlistEntry | null>(null);
  waitlistRef.current = waitlist;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/portal/reservations", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) throw new Error(data.error || "No se pudo cargar");
      // El GET sin date no trae plano: solo salas y mis reservaciones si vienen.
      setMine(data.myReservations ?? []);
    } catch (err) {
      swalError("No se pudo cargar", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sucursales + perfil del cliente (nombre/teléfono prellenados).
  useEffect(() => {
    Promise.all([
      fetch("/api/portal/locations", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/portal/home", { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => null),
    ])
      .then(([locs, home]) => {
        if (locs?.ok) setLocations(locs.locations ?? []);
        const profile = home?.ok ? home?.profile ?? home?.customer ?? null : null;
        setCustomerName(profile?.fullName ?? profile?.name ?? null);
        setCustomerPhone(profile?.phone ?? null);
      })
      .catch(() => undefined);
  }, []);

  const loadWaitlist = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/waitlist", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) return;
      const prev = waitlistRef.current;
      const next: WaitlistEntry | null = data.entry ?? null;
      setWaitlist(next);
      if (prev?.status === "waiting" && next?.status === "available" && next.availableTable) {
        swalToast(`¡Mesa #${next.availableTable.number} disponible para tu grupo!`);
      }
    } catch {
      /* noop: la sección se queda con lo último que tenga */
    }
  }, []);

  useEffect(() => {
    void load();
    void loadWaitlist();
  }, [load, loadWaitlist, reloadKey]);

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
        body: JSON.stringify({ guests: 2 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo anotar");
      setWaitlist(data.entry ?? null);
      swalToast("Estás en la lista de espera — te avisaremos al liberarse una mesa");
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
      setReloadKey((k) => k + 1);
    } catch (err) {
      swalError("No se pudo confirmar", err instanceof Error ? err.message : undefined);
      setWaitlist(null);
      void loadWaitlist();
    } finally {
      setWaitlistBusy(false);
    }
  };

  return (
    <div className="space-y-5 p-4">
      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : (
        <>
          <ReservationWizard
            key={reloadKey}
            locations={locations}
            customerName={customerName}
            customerPhone={customerPhone}
            createUrl="/api/portal/reservations"
            availabilityUrl="/api/table-reservations/availability?"
            doneMessage="Reservación registrada"
            onDone={() => setReloadKey((k) => k + 1)}
          />

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
                    <p className="text-sm font-semibold">En espera · posición #{waitlist.position + 1}</p>
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
                    Anótate y te avisamos al instante cuando se libere una.
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
