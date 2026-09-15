"use client";

import { useEffect, useState } from "react";
import * as yup from "yup";
import { AlertCircle, Loader2, Save, ScrollText } from "lucide-react";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputGroupField } from "@/components/base/input-group-field";
import { SwitchField } from "@/components/base/switch-field";
import { swalToast } from "@/lib/swal";
import { useFocusInvalid } from "@/hooks/use-focus-invalid";

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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const { focusFirstEnabled, focusFirstInvalid } = useFocusInvalid();

  useEffect(() => {
    if (!open) return;
    setForm(null);
    setFormError(undefined);
    setErrors({});
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
        setFormError("No se pudo cargar la política; se muestran valores predeterminados.");
        setForm({ ...DEFAULTS });
      });
  }, [open]);

  const ready = open && Boolean(form);
  useEffect(() => {
    if (!ready) return;
    const frame = window.requestAnimationFrame(() => focusFirstEnabled("reservation-policy-form"));
    return () => window.cancelAnimationFrame(frame);
  }, [focusFirstEnabled, ready]);

  const save = async () => {
    if (!form) return;
    try {
      await yup.object({
        minNoticeMinutes: yup.number().typeError("Ingresa minutos válidos").min(0, "No puede ser negativo").required("Campo obligatorio"),
        maxAdvanceDays: yup.number().typeError("Ingresa días válidos").integer("Usa días completos").min(1, "Mínimo 1 día").required("Campo obligatorio"),
        maxGuests: yup.number().typeError("Ingresa un número válido").integer("Usa un número entero").min(1, "Mínimo 1 comensal").required("Campo obligatorio"),
        maxReservationsPerDay: yup.number().transform((value, original) => original === "" ? undefined : value).typeError("Ingresa un número válido").integer("Usa un número entero").min(1, "Mínimo 1 reservación").optional(),
        durationMinutes: yup.number().typeError("Ingresa minutos válidos").integer("Usa minutos completos").min(30, "Mínimo 30 minutos").required("Campo obligatorio"),
        slotMinutes: yup.number().typeError("Ingresa minutos válidos").integer("Usa minutos completos").min(15, "Mínimo 15 minutos").required("Campo obligatorio"),
        notesText: yup.string().max(300, "Máximo 300 caracteres"),
      }).validate(form, { abortEarly: false });
      setErrors({});
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        const next: Record<string, string> = {};
        for (const failure of error.inner) if (failure.path && !next[failure.path]) next[failure.path] = failure.message;
        setErrors(next);
        const focusErrors = Object.fromEntries(Object.entries(next).map(([key, message]) => [`reservation-${key}`, message]));
        window.requestAnimationFrame(() => focusFirstInvalid(focusErrors, "reservation-policy-form"));
      }
      return;
    }
    setSaving(true);
    setFormError(undefined);
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
      setFormError(err instanceof Error ? err.message : "No se pudo guardar la política");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogComponent
      open={open}
      onOpenChange={onOpenChange}
      title="Política de reservación"
      description="Define disponibilidad, anticipación y confirmación para todos los canales."
      icon={<ScrollText className="size-5" />}
      footer={form ? (
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" form="reservation-policy-form" disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Guardar política
          </Button>
        </>
      ) : undefined}
    >
      {!form ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <form id="reservation-policy-form" noValidate onSubmit={(event) => { event.preventDefault(); void save(); }} className="space-y-4">
          {formError && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {formError}
            </div>
          )}
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
              id="reservation-minNoticeMinutes"
              label="Anticipación mínima (min)"
              type="number"
              min={0}
              value={form.minNoticeMinutes}
              onChange={(e) => setForm({ ...form, minNoticeMinutes: e.target.value.replace(/\D/g, "") })}
              leftIcon={<span className="text-xs">⏱</span>}
              error={errors.minNoticeMinutes}
            />
            <InputGroupField
              id="reservation-maxAdvanceDays"
              label="Ventana del calendario (días)"
              type="number"
              min={1}
              value={form.maxAdvanceDays}
              onChange={(e) => setForm({ ...form, maxAdvanceDays: e.target.value.replace(/\D/g, "") })}
              error={errors.maxAdvanceDays}
            />
            <InputGroupField
              id="reservation-maxGuests"
              label="Máx. comensales"
              type="number"
              min={1}
              value={form.maxGuests}
              onChange={(e) => setForm({ ...form, maxGuests: e.target.value.replace(/\D/g, "") })}
              error={errors.maxGuests}
            />
            <InputGroupField
              id="reservation-maxReservationsPerDay"
              label="Reservas por cliente/día (opcional)"
              type="number"
              min={1}
              placeholder="Sin límite"
              value={form.maxReservationsPerDay}
              onChange={(e) => setForm({ ...form, maxReservationsPerDay: e.target.value.replace(/\D/g, "") })}
              error={errors.maxReservationsPerDay}
            />
            <InputGroupField
              id="reservation-durationMinutes"
              label="Duración de la mesa (min)"
              type="number"
              min={30}
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: e.target.value.replace(/\D/g, "") })}
              error={errors.durationMinutes}
            />
            <InputGroupField
              id="reservation-slotMinutes"
              label="Slot del horario (min)"
              type="number"
              min={15}
              value={form.slotMinutes}
              onChange={(e) => setForm({ ...form, slotMinutes: e.target.value.replace(/\D/g, "") })}
              error={errors.slotMinutes}
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
            id="reservation-notesText"
            label="Nota para el cliente (opcional)"
            placeholder="Ej: grupos de más de 8 llámanos al 55-1234-5678"
            value={form.notesText}
            onChange={(e) => setForm({ ...form, notesText: e.target.value.slice(0, 300) })}
            error={errors.notesText}
          />
          <p className="text-xs text-muted-foreground">
            El calendario solo permite elegir días y horas con la sucursal abierta (horario de la sucursal) y
            respetando estas reglas.
          </p>
        </form>
      )}
    </DialogComponent>
  );
}
