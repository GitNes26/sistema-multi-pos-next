"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, ScrollText } from "lucide-react";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputGroupField } from "@/components/base/input-group-field";
import { SwitchField } from "@/components/base/switch-field";
import { swalError, swalToast } from "@/lib/swal";

// Política de reservación de mesas: reglas que se aplican al reservar desde el
// portal, el enlace de invitado y este panel, y que el flujo le recuerda al
// cliente (anticipación, ventana del calendario, comensales, tope diario,
// duración de la mesa y slot del horario).

interface PolicyForm {
  enabled: boolean;
  minNoticeMinutes: string;
  maxAdvanceDays: string;
  maxGuests: string;
  maxReservationsPerDay: string;
  durationMinutes: string;
  slotMinutes: string;
  requireConfirmation: boolean;
  notesText: string;
}

const DEFAULTS: PolicyForm = {
  enabled: true,
  minNoticeMinutes: "60",
  maxAdvanceDays: "60",
  maxGuests: "20",
  maxReservationsPerDay: "",
  durationMinutes: "120",
  slotMinutes: "30",
  requireConfirmation: false,
  notesText: "",
};

export function ReservationPolicyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState<PolicyForm | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(null);
    fetch("/api/table-reservations/policy")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) throw new Error(d.error);
        const p = d.policy;
        setForm({
          enabled: p.enabled ?? true,
          minNoticeMinutes: String(p.minNoticeMinutes ?? 60),
          maxAdvanceDays: String(p.maxAdvanceDays ?? 60),
          maxGuests: String(p.maxGuests ?? 20),
          maxReservationsPerDay: p.maxReservationsPerDay != null ? String(p.maxReservationsPerDay) : "",
          durationMinutes: String(p.durationMinutes ?? 120),
          slotMinutes: String(p.slotMinutes ?? 30),
          requireConfirmation: Boolean(p.requireConfirmation),
          notesText: p.notesText ?? "",
        });
      })
      .catch(() => {
        swalError("No se pudo cargar la política");
        setForm({ ...DEFAULTS });
      });
  }, [open]);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const res = await fetch("/api/table-reservations/policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          minNoticeMinutes: Number(form.minNoticeMinutes) || 0,
          maxAdvanceDays: Number(form.maxAdvanceDays) || 60,
          maxGuests: Number(form.maxGuests) || 20,
          maxReservationsPerDay: form.maxReservationsPerDay === "" ? null : Number(form.maxReservationsPerDay),
          durationMinutes: Number(form.durationMinutes) || 120,
          slotMinutes: Number(form.slotMinutes) || 30,
          notesText: form.notesText,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "No se pudo guardar");
      swalToast("Política guardada — se aplica al reservar");
      onOpenChange(false);
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogComponent open={open} onOpenChange={onOpenChange} title="Política de reservación">
      {!form ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4 p-4">
          <SwitchField
            id="SwitchReservacionesActivas"
            label="Permitir reservaciones"
            description="Desactívalo para pausar las reservas en todos los canales."
            icon={<ScrollText className="size-4" />}
            checked={form.enabled}
            onCheckedChange={(v) => setForm({ ...form, enabled: v })}
          />
          <div className="grid grid-cols-2 gap-3">
            <InputGroupField
              label="Anticipación mínima (min)"
              type="number"
              min={0}
              value={form.minNoticeMinutes}
              onChange={(e) => setForm({ ...form, minNoticeMinutes: e.target.value.replace(/\D/g, "") })}
              leftIcon={<span className="text-xs">⏱</span>}
            />
            <InputGroupField
              label="Ventana del calendario (días)"
              type="number"
              min={1}
              value={form.maxAdvanceDays}
              onChange={(e) => setForm({ ...form, maxAdvanceDays: e.target.value.replace(/\D/g, "") })}
            />
            <InputGroupField
              label="Máx. comensales"
              type="number"
              min={1}
              value={form.maxGuests}
              onChange={(e) => setForm({ ...form, maxGuests: e.target.value.replace(/\D/g, "") })}
            />
            <InputGroupField
              label="Reservas por cliente/día (opcional)"
              type="number"
              min={1}
              placeholder="Sin límite"
              value={form.maxReservationsPerDay}
              onChange={(e) => setForm({ ...form, maxReservationsPerDay: e.target.value.replace(/\D/g, "") })}
            />
            <InputGroupField
              label="Duración de la mesa (min)"
              type="number"
              min={30}
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: e.target.value.replace(/\D/g, "") })}
            />
            <InputGroupField
              label="Slot del horario (min)"
              type="number"
              min={15}
              value={form.slotMinutes}
              onChange={(e) => setForm({ ...form, slotMinutes: e.target.value.replace(/\D/g, "") })}
            />
          </div>
          <SwitchField
            id="SwitchConfirmacionAnfitrion"
            label="El anfitrión debe confirmar"
            description="Si está apagado, la reservación nace confirmada."
            icon={<ScrollText className="size-4" />}
            checked={form.requireConfirmation}
            onCheckedChange={(v) => setForm({ ...form, requireConfirmation: v })}
          />
          <InputGroupField
            label="Nota para el cliente (opcional)"
            placeholder="Ej: grupos de más de 8 llámanos al 55-1234-5678"
            value={form.notesText}
            onChange={(e) => setForm({ ...form, notesText: e.target.value.slice(0, 300) })}
          />
          <p className="text-[11px] text-muted-foreground">
            El calendario solo permite elegir días y horas con la sucursal abierta (horario de la sucursal) y
            respetando estas reglas.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Guardar política
            </Button>
          </div>
        </div>
      )}
    </DialogComponent>
  );
}
