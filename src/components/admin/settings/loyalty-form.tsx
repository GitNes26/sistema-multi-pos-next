"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { settingsApi } from "@/lib/settings/client";
import type { LoyaltySettings } from "@/lib/settings/server";
import { swalError, swalToast } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

export function LoyaltyForm() {
  const [form, setForm] = useState<LoyaltySettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi
      .loyalty()
      .then((d) => setForm(d.settings))
      .catch(() => undefined);
  }, []);

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const res = await settingsApi.updateLoyalty({
        pointsPerCurrency: Number(form.pointsPerCurrency),
        pointValue: Number(form.pointValue),
        loyaltyEnabled: form.loyaltyEnabled,
      });
      setForm(res.settings);
      swalToast("Configuración de lealtad guardada");
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
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Puntos por unidad de moneda</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.pointsPerCurrency}
            onChange={(e) => setForm({ ...form, pointsPerCurrency: Number(e.target.value) })}
          />
          <p className="text-xs text-muted-foreground">
            Puntos ganados por cada unidad monetaria gastada.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Valor del punto</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.pointValue}
            onChange={(e) => setForm({ ...form, pointValue: Number(e.target.value) })}
          />
          <p className="text-xs text-muted-foreground">
            Valor monetario de cada punto al canjear.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Lealtad habilitada</p>
          <p className="text-xs text-muted-foreground">Acumular y canjear puntos</p>
        </div>
        <Switch
          checked={form.loyaltyEnabled}
          onCheckedChange={(v) => setForm({ ...form, loyaltyEnabled: v })}
        />
      </div>

      <Button onClick={save} disabled={saving}>
        <Sparkles className="size-4" /> {saving ? "Guardando…" : "Guardar cambios"}
      </Button>
    </div>
  );
}
