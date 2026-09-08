"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  CalendarCheck2,
  Loader2,
  MessageCircle,
  Phone,
  SearchCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { swalConfirm, swalError, swalToast } from "@/lib/swal";
import { cn } from "@/lib/utils";

// Verificación del invitado (sin cuenta): teléfono + código de corto plazo
// para confirmar o cancelar su reservación. El código se genera al reservar
// (aparece en pantalla y viaja por WhatsApp/SMS) y aquí se puede pedir de nuevo.

interface GuestReservationRow {
  id: string;
  organizationName: string;
  guests: number;
  name: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  tableNumber: number | null;
  roomName: string | null;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export function GuestReservationVerify() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"verify" | "send" | "manage" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reservations, setReservations] = useState<GuestReservationRow[] | null>(null);

  const verify = async () => {
    if (phone.trim().length < 7) {
      swalError("Ingresa tu teléfono");
      return;
    }
    if (!/^\d{4,8}$/.test(code.trim())) {
      swalError("Ingresa el código de 6 dígitos");
      return;
    }
    setBusy("verify");
    setNotice(null);
    try {
      const res = await fetch("/api/public/reservations/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), code: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo verificar");
      setReservations(data.reservations ?? []);
      if ((data.reservations ?? []).length === 0) {
        setNotice("Código inválido o vencido — pide uno nuevo");
      }
    } catch (err) {
      swalError("No se pudo verificar", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const sendCode = async () => {
    if (phone.trim().length < 7) {
      swalError("Ingresa tu teléfono");
      return;
    }
    setBusy("send");
    setNotice(null);
    try {
      const res = await fetch("/api/public/reservations/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo enviar");
      setNotice(data.message ?? null);
      if (data.sent) swalToast(`Código enviado por ${data.channel === "whatsapp" ? "WhatsApp" : "SMS"}`);
    } catch (err) {
      swalError("No se pudo enviar", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const manage = async (row: GuestReservationRow, action: "confirm" | "cancel") => {
    if (action === "cancel") {
      const ok = await swalConfirm(
        "¿Cancelar tu reservación?",
        `Se libera tu mesa del ${when(row.startsAt)}.`,
        { confirmText: "Cancelar reservación", danger: true }
      );
      if (!ok) return;
    }
    setBusy("manage");
    try {
      const res = await fetch("/api/public/reservations/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          code: code.trim(),
          reservationId: row.id,
          action,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo actualizar");
      swalToast(data.message ?? "Listo");
      await verify();
    } catch (err) {
      swalError("No se pudo actualizar", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Teléfono + código */}
      <div className="rounded-2xl border bg-muted/30 p-3.5">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="relative">
            <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Tu teléfono"
              inputMode="tel"
              className="h-11 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm"
            />
          </div>
          <div className="relative">
            <SearchCheck className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Código de 6 dígitos"
              inputMode="numeric"
              className="h-11 w-full rounded-lg border border-input bg-background pl-9 pr-3 font-mono text-sm tracking-widest"
            />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button onClick={verify} disabled={busy !== null} className="h-9">
            {busy === "verify" ? <Loader2 className="size-4 animate-spin" /> : <SearchCheck className="size-4" />}
            Verificar
          </Button>
          <Button onClick={sendCode} disabled={busy !== null} variant="outline" className="h-9">
            {busy === "send" ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
            Enviarme un código
          </Button>
          <Link href="/reservar" className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:underline">
            Hacer una reservación
          </Link>
        </div>
        {notice && (
          <p className="mt-2 rounded-lg border bg-background px-3 py-1.5 text-xs text-muted-foreground">{notice}</p>
        )}
      </div>

      {/* Resultado */}
      {reservations?.length === 0 && (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No encontramos reservaciones activas con esos datos.
        </p>
      )}

      {reservations?.map((r) => (
        <div key={r.id} className="rounded-2xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarCheck2 className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{r.organizationName}</p>
              <p className="text-xs text-muted-foreground">
                {when(r.startsAt)} · {r.guests} {r.guests === 1 ? "persona" : "personas"}
                {r.tableNumber ? ` · Mesa ${r.tableNumber}` : r.roomName ? ` · ${r.roomName}` : " · sin mesa"}
                {r.name ? ` · ${r.name}` : ""}
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                r.status === "confirmed" ? "text-sky-600" : r.status === "pending" ? "text-amber-600" : "text-muted-foreground"
              )}
            >
              {r.status === "confirmed" ? "Confirmada" : r.status === "pending" ? "Pendiente" : r.status}
            </Badge>
          </div>
          <div className="mt-3 flex gap-2">
            {r.status === "pending" && (
              <Button
                size="sm"
                onClick={() => manage(r, "confirm")}
                disabled={busy !== null}
                className="h-8 px-3 text-xs"
              >
                {busy === "manage" ? <Loader2 className="size-3.5 animate-spin" /> : <BadgeCheck className="size-3.5" />}
                Confirmar
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => manage(r, "cancel")}
              disabled={busy !== null}
              className="h-8 px-3 text-xs text-destructive"
            >
              <XCircle className="size-3.5" />
              Cancelar reservación
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
