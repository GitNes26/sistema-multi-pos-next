"use client";

import { useEffect, useState } from "react";
import { Coins, DollarSign, Sparkles } from "lucide-react";
import { settingsApi } from "@/lib/settings/client";
import type { LoyaltySettings } from "@/lib/settings/server";
import { swalError, swalToast } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { InputGroupField } from "@/components/base/input-group-field";

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
        <InputGroupField
          label="Puntos por unidad de moneda"
          helper="Puntos ganados por cada unidad monetaria gastada."
          type="number"
          min={0}
          step="0.01"
          leftIcon={<Coins className="size-4" />}
          value={form.pointsPerCurrency}
          onChange={(e) => setForm({ ...form, pointsPerCurrency: Number(e.target.value) })}
        />
        <InputGroupField
          label="Valor del punto"
          helper="Valor monetario de cada punto al canjear."
          type="number"
          min={0}
          step="0.01"
          leftIcon={<DollarSign className="size-4" />}
          value={form.pointValue}
          onChange={(e) => setForm({ ...form, pointValue: Number(e.target.value) })}
        />
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
