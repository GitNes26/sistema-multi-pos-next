"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { settingsApi } from "@/lib/settings/client";
import { SUPERVISOR_ACTIONS, type SupervisorSettings } from "@/lib/settings/server";
import { swalError, swalToast } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

export function SupervisorForm() {
  const [form, setForm] = useState<SupervisorSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi
      .supervisor()
      .then((d) => setForm(d.settings))
      .catch(() => undefined);
  }, []);

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
    setSaving(true);
    try {
      const res = await settingsApi.updateSupervisor({
        required: form.required,
        actions: form.actions,
      });
      setForm(res.settings);
      swalToast("Configuración de supervisor guardada");
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined);
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
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border p-3">
        <label htmlFor="sup-required" className="cursor-pointer">
          <span className="block text-sm font-medium">Requerir aprobación de supervisor</span>
          <span className="block text-xs text-muted-foreground">
            Activa la verificación para las acciones seleccionadas.
          </span>
        </label>
        <Switch id="sup-required" checked={form.required} onCheckedChange={(v) => setForm({ ...form, required: v })} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Acciones que requieren aprobación</p>
        {SUPERVISOR_ACTIONS.map((a) => (
          <label key={a.key} className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm">
            <Checkbox
              checked={form.actions.includes(a.key)}
              onCheckedChange={() => toggleAction(a.key)}
            />
            <span>{a.label}</span>
          </label>
        ))}
      </div>

      <Button onClick={save} disabled={saving}>
        <ShieldCheck className="size-4" /> {saving ? "Guardando…" : "Guardar cambios"}
      </Button>
    </div>
  );
}
