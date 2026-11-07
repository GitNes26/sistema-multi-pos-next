"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Camera, ClipboardCheck, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputGroupField } from "@/components/base/input-group-field";
import { SwitchField } from "@/components/base/switch-field";
import { SegmentedFilter } from "@/components/base/segmented-filter";
import { cn } from "@/lib/utils";
import type { ChecklistTemplate } from "./checklist-run-dialog";

type Phase = "intake" | "delivery";
interface Item {
  label: string;
  requirePhoto: boolean;
}
interface Draft {
  isRequired: boolean;
  items: Item[];
}

const PHASES: { value: Phase; label: string; hint: string; starter: string[] }[] = [
  { value: "intake", label: "Ingreso", hint: "Se revisa al recibir el vehículo: daños previos y objetos dentro.", starter: ["Rayones o golpes", "Objetos de valor en el interior", "Cristales y espejos"] },
  { value: "delivery", label: "Entrega", hint: "Se revisa antes de entregar y cobrar.", starter: ["Exterior limpio", "Interior limpio", "Sin daños nuevos"] },
];

const emptyDraft = (): Record<Phase, Draft> => ({ intake: { isRequired: false, items: [] }, delivery: { isRequired: false, items: [] } });

/** Editor de las listas de revisión de ingreso y entrega. Sin puntos, la fase queda sin lista. */
export function ChecklistTemplatesDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const [phase, setPhase] = useState<Phase>("intake");
  const [drafts, setDrafts] = useState<Record<Phase, Draft> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDrafts(null);
    fetch("/api/service-orders/checklists", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const next = emptyDraft();
        for (const t of (d.templates ?? []) as ChecklistTemplate[]) {
          if (t.phase === "intake" || t.phase === "delivery") next[t.phase] = { isRequired: t.isRequired, items: t.items.map((i) => ({ label: i.label, requirePhoto: i.requirePhoto })) };
        }
        setDrafts(next);
      })
      .catch(() => {
        setDrafts(emptyDraft());
        setError("No se pudieron cargar las listas");
      });
  }, [open]);

  const meta = PHASES.find((p) => p.value === phase)!;
  const draft = drafts?.[phase];
  const set = (patch: Partial<Draft>) => drafts && draft && setDrafts({ ...drafts, [phase]: { ...draft, ...patch } });
  const setItem = (i: number, patch: Partial<Item>) => draft && set({ items: draft.items.map((it, at) => (at === i ? { ...it, ...patch } : it)) });
  const move = (i: number, dir: -1 | 1) => {
    if (!draft) return;
    const j = i + dir;
    if (j < 0 || j >= draft.items.length) return;
    const next = [...draft.items];
    [next[i], next[j]] = [next[j], next[i]];
    set({ items: next });
  };

  const save = async () => {
    if (!draft) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/service-orders/checklists", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase, isRequired: draft.isRequired && draft.items.some((i) => i.label.trim()), items: draft.items }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo guardar la lista");
      toast.success(data.template ? "Lista guardada" : "Lista quitada");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la lista");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogComponent
      open={open}
      onOpenChange={onOpenChange}
      icon={<ClipboardCheck className="size-5" />}
      title="Listas de revisión"
      description="Puntos a verificar al recibir y al entregar, con foto de los problemas."
      className="sm:max-w-xl"
      footer={
        <>
          {error && <p className="mr-auto text-sm font-medium text-destructive">{error}</p>}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button onClick={() => void save()} disabled={saving || !draft}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Guardar {meta.label.toLowerCase()}
          </Button>
        </>
      }
    >
      {!draft ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-4">
          <SegmentedFilter ariaLabel="Fase" value={phase} onChange={setPhase} options={PHASES.map((p) => ({ value: p.value, label: p.label, count: drafts![p.value].items.filter((i) => i.label.trim()).length || undefined }))} />
          <p className="text-sm text-muted-foreground">{meta.hint}</p>

          <ol className="space-y-2">
            {draft.items.map((it, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl border p-2">
                <InputGroupField label="Punto a revisar" value={it.label} onChange={(e) => setItem(i, { label: e.target.value })} placeholder="Ej. Rayones o golpes" maxLength={120} containerClassName="min-w-48 flex-1" />
                <button type="button" aria-pressed={it.requirePhoto} onClick={() => setItem(i, { requirePhoto: !it.requirePhoto })} title="Pedir foto cuando se marque «Problema»" className={cn("press inline-flex min-h-9 items-center gap-1 rounded-full border px-2.5 text-xs", it.requirePhoto ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50")}>
                  <Camera className="size-3.5" /> Foto
                </button>
                <span className="ml-auto flex items-center">
                  <Button type="button" variant="ghost" size="icon" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="Bajar" disabled={i === draft.items.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="text-destructive" aria-label="Quitar punto" onClick={() => set({ items: draft.items.filter((_, at) => at !== i) })}>
                    <Trash2 className="size-4" />
                  </Button>
                </span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={draft.items.length >= 30} onClick={() => set({ items: [...draft.items, { label: "", requirePhoto: true }] })}>
              <Plus className="size-4" /> Agregar punto
            </Button>
            {draft.items.length === 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => set({ items: meta.starter.map((label) => ({ label, requirePhoto: true })) })}>
                Usar puntos de ejemplo
              </Button>
            )}
          </div>
          <SwitchField
            id={`SwitchRevisionObligatoria-${phase}`}
            label="Obligatoria"
            description={phase === "intake" ? "Sin esta revisión la orden no sale de la primera etapa." : "Sin esta revisión no se cobra ni se entrega."}
            icon={<ClipboardCheck className="size-4" />}
            checked={draft.isRequired}
            onCheckedChange={(v) => set({ isRequired: v })}
          />
          <p className="text-xs text-muted-foreground">Quita todos los puntos y guarda para dejar esta fase sin lista. Las revisiones ya hechas conservan su texto.</p>
        </div>
      )}
    </DialogComponent>
  );
}
