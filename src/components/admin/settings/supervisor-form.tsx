"use client";

import { useEffect, useState } from "react";
import * as yup from "yup";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { settingsApi } from "@/lib/settings/client";
import { SUPERVISOR_ACTIONS, type SupervisorSettings } from "@/lib/settings/server";
import { swalToast } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { SwitchField } from "@/components/base/switch-field";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useFocusInvalid } from "@/hooks/use-focus-invalid";

export function SupervisorForm() {
  const [form, setForm] = useState<SupervisorSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string>();
  const [actionsError, setActionsError] = useState<string>();
  const { focusFirstEnabled, focusFirstInvalid } = useFocusInvalid();

  useEffect(() => {
    settingsApi
      .supervisor()
      .then((d) => setForm(d.settings))
      .catch(() => setFormError("No se pudo cargar la configuración de supervisor"));
  }, []);

  const ready = Boolean(form);
  useEffect(() => {
    if (!ready) return;
    const frame = window.requestAnimationFrame(() => focusFirstEnabled("supervisor-form"));
    return () => window.cancelAnimationFrame(frame);
  }, [focusFirstEnabled, ready]);

  const toggleAction = (key: string) => {
    setForm((f) =>
      f
        ? {
            ...f,
            actions: f.actions.includes(key)
              ? f.actions.filter((a) => a !== key)
              : [...f.actions, key],
          }
        : f
    );
  };

  const save = async () => {
    if (!form) return;
    try {
      await yup.object({
        required: yup.boolean().required(),
        actions: yup.array(yup.string().required()).when("required", {
          is: true,
          then: (schema) => schema.min(1, "Selecciona al menos una acción que requiera aprobación"),
        }),
      }).validate(form);
      setActionsError(undefined);
    } catch (error) {
      const message = error instanceof yup.ValidationError ? error.message : "Revisa las acciones seleccionadas";
      setActionsError(message);
      const firstId = SUPERVISOR_ACTIONS[0]?.key ? `sup-action-${SUPERVISOR_ACTIONS[0].key}` : "sup-required";
      window.requestAnimationFrame(() => focusFirstInvalid({ [firstId]: message }, "supervisor-form"));
      return;
    }
    setSaving(true);
    setFormError(undefined);
    try {
      const res = await settingsApi.updateSupervisor({
        required: form.required,
        actions: form.actions,
      });
      setForm(res.settings);
      swalToast("Configuración de supervisor guardada");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <form id="supervisor-form" noValidate onSubmit={(event) => { event.preventDefault(); void save(); }} className="space-y-4">
      {formError && <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" />{formError}</div>}
      <SwitchField
        id="sup-required"
        label="Requerir aprobación de supervisor"
        description="Activa la verificación para las acciones seleccionadas."
        icon={<ShieldCheck className="size-4" />}
        checked={form.required}
        onCheckedChange={(v) => setForm({ ...form, required: v })}
      />

      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm font-medium"><ShieldCheck className="size-4 text-muted-foreground" />Acciones que requieren aprobación</p>
        {SUPERVISOR_ACTIONS.map((a) => (
          <label htmlFor={`sup-action-${a.key}`} key={a.key} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm">
            <Checkbox
              id={`sup-action-${a.key}`}
              checked={form.actions.includes(a.key)}
              onCheckedChange={() => toggleAction(a.key)}
            />
            <span>{a.label}</span>
          </label>
        ))}
        {actionsError && <p role="alert" className="text-xs text-destructive">{actionsError}</p>}
      </div>

      <Button type="submit" disabled={saving}>
        <ShieldCheck className="size-4" /> {saving ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
