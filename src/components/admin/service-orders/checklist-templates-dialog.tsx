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

type Phase = "intake" | "delivery" | "return";
type Subject = "service_order" | "reservation";
interface Item {
  label: string;
  requirePhoto: boolean;
}
interface Draft {
  isRequired: boolean;
  items: Item[];
}

interface PhaseMeta {
  value: Phase;
  label: string;
  hint: string;
  starter: string[];
  requiredHint: string;
}

const PHASES_BY_SUBJECT: Record<Subject, { endpoint: string; phases: PhaseMeta[] }> = {
  service_order: {
    endpoint: "/api/service-orders/checklists",
    phases: [
      { value: "intake", label: "Ingreso", hint: "Se revisa al recibir el vehículo: daños previos y objetos dentro.", starter: ["Rayones o golpes", "Objetos de valor en el interior", "Cristales y espejos"], requiredHint: "Sin esta revisión la orden no sale de la primera etapa." },
      { value: "delivery", label: "Entrega", hint: "Se revisa antes de entregar y cobrar.", starter: ["Exterior limpio", "Interior limpio", "Sin daños nuevos"], requiredHint: "Sin esta revisión no se cobra ni se entrega." },
    ],
  },
  reservation: {
    endpoint: "/api/reservaciones/checklists",
    phases: [
      { value: "delivery", label: "Entrega", hint: "Se revisa el estado del equipo antes de dárselo al cliente.", starter: ["Equipo completo y funcionando", "Sin daños visibles", "Accesorios incluidos"], requiredHint: "Sin esta revisión no se entrega el equipo." },
      { value: "return", label: "Devolución", hint: "Se revisa al recibirlo de vuelta para detectar daños o faltantes.", starter: ["Equipo completo", "Sin daños nuevos", "Limpio"], requiredHint: "Sin esta revisión no se recibe el equipo ni se liquida el depósito." },
    ],
  },
};

const emptyDraft = (phases: PhaseMeta[]): Record<Phase, Draft> => {
  const base = { intake: { isRequired: false, items: [] }, delivery: { isRequired: false, items: [] }, return: { isRequired: false, items: [] } } as Record<Phase, Draft>;
  for (const p of phases) base[p.value] = { isRequired: false, items: [] };
  return base;
};

/** Editor de las listas de revisión de ingreso y entrega. Sin puntos, la fase queda sin lista. */
export function ChecklistTemplatesDialog({ open, onOpenChange, onSaved, subject = "service_order" }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void; subject?: Subject }) {
  const { endpoint, phases: PHASES } = PHASES_BY_SUBJECT[subject];
  const [phase, setPhase] = useState<Phase>(PHASES[0].value);
  const [drafts, setDrafts] = useState<Record<Phase, Draft> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setDrafts(null);
    setPhase(PHASES[0].value);
    fetch(endpoint, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const next = emptyDraft(PHASES);
        for (const t of (d.templates ?? []) as ChecklistTemplate[]) {
          if (PHASES.some((p) => p.value === t.phase)) next[t.phase as Phase] = { isRequired: t.isRequired, items: t.items.map((i) => ({ label: i.label, requirePhoto: i.requirePhoto })) };
        }
        setDrafts(next);
      })
      .catch(() => {
        setDrafts(emptyDraft(PHASES));
        setError("No se pudieron cargar las listas");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- PHASES/endpoint solo cambian con `subject`
  }, [open, subject]);

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
      const res = await fetch(endpoint, {
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
      description={subject === "reservation" ? "Puntos a verificar al entregar y al recibir el equipo, con foto de los problemas." : "Puntos a verificar al recibir y al entregar, con foto de los problemas."}
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
            description={meta.requiredHint}
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
