"use client";

import { useEffect, useState } from "react";
import * as yup from "yup";
import { AlertCircle, Clock, Loader2, Save, ScrollText } from "lucide-react";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputGroupField } from "@/components/base/input-group-field";
import { SwitchField } from "@/components/base/switch-field";
import { swalToast } from "@/lib/swal";
import { useFocusInvalid } from "@/hooks/use-focus-invalid";

// Política de citas: horario del negocio, anticipación, reagenda y tolerancia de llegada.
// Se aplica al agendar, reagendar y recibir al cliente; cada movimiento queda en el historial de la cita.

interface PolicyForm {
  enforceBusinessHours: boolean;
  minNoticeMinutes: string;
  maxAdvanceDays: string;
  rescheduleMinNoticeMinutes: string;
  maxReschedules: string;
  toleranceMinutes: string;
}

const DEFAULTS: PolicyForm = {
  enforceBusinessHours: true,
  minNoticeMinutes: "30",
  maxAdvanceDays: "60",
  rescheduleMinNoticeMinutes: "120",
  maxReschedules: "2",
  toleranceMinutes: "15",
};

const digits = (v: string) => v.replace(/\D/g, "");

export function AppointmentPolicyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
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
    fetch("/api/agenda/policy", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) throw new Error(d.error);
        const p = d.policy;
        setForm({
          enforceBusinessHours: Boolean(p.enforceBusinessHours),
          minNoticeMinutes: String(p.minNoticeMinutes),
          maxAdvanceDays: String(p.maxAdvanceDays),
          rescheduleMinNoticeMinutes: String(p.rescheduleMinNoticeMinutes),
          maxReschedules: p.maxReschedules != null ? String(p.maxReschedules) : "",
          toleranceMinutes: String(p.toleranceMinutes),
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
    const frame = window.requestAnimationFrame(() => focusFirstEnabled("appointment-policy-form"));
    return () => window.cancelAnimationFrame(frame);
  }, [focusFirstEnabled, ready]);

  const save = async () => {
    if (!form) return;
    try {
      await yup
        .object({
          minNoticeMinutes: yup.number().typeError("Ingresa minutos válidos").integer("Usa minutos completos").min(0, "No puede ser negativo").max(10080, "Máximo 7 días").required("Campo obligatorio"),
          maxAdvanceDays: yup.number().typeError("Ingresa días válidos").integer("Usa días completos").min(1, "Mínimo 1 día").max(365, "Máximo 365 días").required("Campo obligatorio"),
          rescheduleMinNoticeMinutes: yup.number().typeError("Ingresa minutos válidos").integer("Usa minutos completos").min(0, "No puede ser negativo").max(10080, "Máximo 7 días").required("Campo obligatorio"),
          maxReschedules: yup.number().transform((value, original) => (original === "" ? undefined : value)).typeError("Ingresa un número válido").integer("Usa un número entero").min(0, "No puede ser negativo").max(20, "Máximo 20").optional(),
          toleranceMinutes: yup.number().typeError("Ingresa minutos válidos").integer("Usa minutos completos").min(0, "No puede ser negativo").max(240, "Máximo 4 horas").required("Campo obligatorio"),
        })
        .validate(form, { abortEarly: false });
      setErrors({});
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        const next: Record<string, string> = {};
        for (const failure of error.inner) if (failure.path && !next[failure.path]) next[failure.path] = failure.message;
        setErrors(next);
        const focusErrors = Object.fromEntries(Object.entries(next).map(([key, message]) => [`appointment-${key}`, message]));
        window.requestAnimationFrame(() => focusFirstInvalid(focusErrors, "appointment-policy-form"));
      }
      return;
    }
    setSaving(true);
    setFormError(undefined);
    try {
      const res = await fetch("/api/agenda/policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enforceBusinessHours: form.enforceBusinessHours,
          minNoticeMinutes: Number(form.minNoticeMinutes),
          maxAdvanceDays: Number(form.maxAdvanceDays),
          rescheduleMinNoticeMinutes: Number(form.rescheduleMinNoticeMinutes),
          maxReschedules: form.maxReschedules === "" ? null : Number(form.maxReschedules),
          toleranceMinutes: Number(form.toleranceMinutes),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "No se pudo guardar");
      swalToast("Política de citas guardada");
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
      title="Política de citas"
      description="Horario, reagenda y tolerancia de llegada. Todo movimiento queda en el historial de la cita."
      icon={<ScrollText className="size-5" />}
      footer={
        form ? (
          <>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="appointment-policy-form" disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Guardar política
            </Button>
          </>
        ) : undefined
      }
    >
      {!form ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <form
          id="appointment-policy-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="space-y-4"
        >
          {formError && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {formError}
            </div>
          )}
          <SwitchField
            id="SwitchCitasHorarioNegocio"
            label="Solo dentro del horario del negocio"
            description="La cita debe empezar y terminar dentro del horario de la sucursal. Si no has configurado horario, no se restringe."
            icon={<Clock className="size-4" />}
            checked={form.enforceBusinessHours}
            onCheckedChange={(v) => setForm({ ...form, enforceBusinessHours: v })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <InputGroupField
              required
              id="appointment-minNoticeMinutes"
              label="Anticipación para agendar (min)"
              helper="Tiempo mínimo entre ahora y la hora de la cita nueva."
              type="number"
              min={0}
              inputMode="numeric"
              value={form.minNoticeMinutes}
              onChange={(e) => setForm({ ...form, minNoticeMinutes: digits(e.target.value) })}
              error={errors.minNoticeMinutes}
            />
            <InputGroupField
              required
              id="appointment-maxAdvanceDays"
              label="Hasta cuántos días adelante"
              helper="Qué tan lejos se puede agendar."
              type="number"
              min={1}
              inputMode="numeric"
              value={form.maxAdvanceDays}
              onChange={(e) => setForm({ ...form, maxAdvanceDays: digits(e.target.value) })}
              error={errors.maxAdvanceDays}
            />
            <InputGroupField
              required
              id="appointment-rescheduleMinNoticeMinutes"
              label="Tiempo mínimo para reagendar (min)"
              helper="Cuánto antes de la cita actual se permite cambiarla."
              type="number"
              min={0}
              inputMode="numeric"
              value={form.rescheduleMinNoticeMinutes}
              onChange={(e) => setForm({ ...form, rescheduleMinNoticeMinutes: digits(e.target.value) })}
              error={errors.rescheduleMinNoticeMinutes}
            />
            <InputGroupField
              id="appointment-maxReschedules"
              label="Máximo de reagendas (opcional)"
              helper="Vacío = sin límite."
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="Sin límite"
              value={form.maxReschedules}
              onChange={(e) => setForm({ ...form, maxReschedules: digits(e.target.value) })}
              error={errors.maxReschedules}
            />
            <InputGroupField
              required
              id="appointment-toleranceMinutes"
              label="Tolerancia de llegada (min)"
              helper="Pasado este tiempo sin «Llegó», la cita se pierde."
              type="number"
              min={0}
              inputMode="numeric"
              value={form.toleranceMinutes}
              onChange={(e) => setForm({ ...form, toleranceMinutes: digits(e.target.value) })}
              error={errors.toleranceMinutes}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Quien administra puede saltarse el tiempo mínimo, el límite de reagendas o la tolerancia dejando un motivo, que
            queda en el historial. El horario del negocio no se puede saltar.
          </p>
        </form>
      )}
    </DialogComponent>
  );
}
