"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck2, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { swalError, swalToast } from "@/lib/swal";
import { ReservationWizard } from "@/components/reservations/reservation-wizard";

// Reservación de mesa SIN cuenta: wizard a pasos (sucursal → calendario según
// políticas → hora/asientos → sala en el plano → nombre y teléfono). La
// organización se resuelve en el servidor desde `?org=` o el QR de mesa.

interface LocationRow {
  id: string;
  name: string;
}

interface WaitlistEntry {
  id: string;
  guests: number;
  status: string;
  position: number;
  availableTable: { id: string; number: number; room: { name: string } | null } | null;
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
  const params = new URLSearchParams();
  if (orgId) params.set("org", orgId);
  if (tableId) {
    params.set("table", tableId);
    if (tableToken) params.set("token", tableToken);
  }
  const orgQuery = params.toString();

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Lista de espera (sin cuenta): si no hay mesa que quepa, el invitado se
  // anota con nombre+teléfono y recibe el aviso de mesa libre por WhatsApp/SMS.
  const [waitlisted, setWaitlisted] = useState<WaitlistEntry | null>(null);
  const [waitlisting, setWaitlisting] = useState(false);
  const [waitlistPhone, setWaitlistPhone] = useState("");

  const loadLocations = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/public/locations?${orgQuery}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo cargar");
      setLocations(data.locations ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "No se pudo cargar");
    } finally {
      setLoading(false);
    }
  }, [orgQuery]);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  const joinWaitlist = async () => {
    if (waitlistPhone.trim().length < 7) {
      swalError("Ingresa un teléfono válido");
      return;
    }
    setWaitlisting(true);
    try {
      const res = await fetch(`/api/public/waitlist?${orgQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: waitlistPhone.trim(), guests: 2 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo anotar");
      setWaitlisted(data.entry ?? null);
      swalToast("Estás en la lista de espera — te avisamos en cuanto se libere una mesa");
    } catch (err) {
      swalError("No se pudo anotar", err instanceof Error ? err.message : undefined);
    } finally {
      setWaitlisting(false);
    }
  };

  const leaveWaitlist = async () => {
    setWaitlisting(true);
    try {
      await fetch(`/api/public/waitlist?${orgQuery}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: waitlistPhone.trim() }),
      });
      setWaitlisted(null);
      swalToast("Saliste de la lista de espera");
    } catch {
      swalError("No se pudo salir de la lista");
    } finally {
      setWaitlisting(false);
    }
  };

  if (loadError) {
    return (
      <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center text-sm text-destructive">
        {loadError}
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Lista de espera: entrada activa del invitado (si la hay). */}
      {waitlisted && (
        <div
          className={
            waitlisted.availableTable
              ? "rounded-2xl border border-emerald-300/60 bg-emerald-50 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10"
              : "rounded-2xl border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10"
          }
        >
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-amber-600" />
            <p className="text-sm font-bold">
              {waitlisted.availableTable
                ? `¡Mesa lista! Mesa #${waitlisted.availableTable.number}${
                    waitlisted.availableTable.room?.name ? ` (${waitlisted.availableTable.room.name})` : ""
                  }`
                : `En lista de espera · posición #${waitlisted.position}`}
            </p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {waitlisted.availableTable
              ? "Te avisamos por WhatsApp/SMS — preséntate y el anfitrión te sentará."
              : `Te avisaremos por WhatsApp/SMS al ${waitlistPhone} cuando se libere una mesa para ${waitlisted.guests}.`}
          </p>
          <Button
            className="mt-3 h-8 px-3 text-xs"
            variant="outline"
            onClick={leaveWaitlist}
            disabled={waitlisting}
          >
            Salir de la lista
          </Button>
        </div>
      )}

      <ReservationWizard
        locations={locations}
        createUrl={`/api/public/reservations?${orgQuery}`}
        availabilityUrl={`/api/public/reservations/availability?${orgQuery}&`}
        onDone={() => undefined}
      />

      {/* ¿Nada disponible? Lista de espera rápida (teléfono basta). */}
      <details className="rounded-xl border border-dashed bg-muted/30 p-3.5">
        <summary className="cursor-pointer text-sm font-medium">
          ¿Nada te conviene? Anótate en la lista de espera
        </summary>
        {!waitlisted && (
          <div className="mt-3 flex gap-2">
            <input
              value={waitlistPhone}
              onChange={(e) => setWaitlistPhone(e.target.value)}
              placeholder="Teléfono para avisarte"
              inputMode="tel"
              className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm"
            />
            <Button onClick={joinWaitlist} disabled={waitlisting}>
              {waitlisting ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />}
              Anotarme
            </Button>
          </div>
        )}
      </details>

      <p className="text-center text-xs text-muted-foreground">
        ¿Ya tienes reservación?{" "}
        <Link
          href="/reservar/verificar"
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          Confírmala o cancela con tu código
        </Link>
      </p>
    </div>
  );
}
