"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Bell, CheckCircle2, Loader2, Plus, Save, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormCombobox } from "@/components/base/form-combobox";
import { InputGroupField } from "@/components/base/input-group-field";
import { SwitchField } from "@/components/base/switch-field";
import { matchesSearch } from "@/lib/search";
import { cn } from "@/lib/utils";
import type { CatalogService, Flow } from "./types";

interface StageDraft {
  id?: string;
  label: string;
  notifyCustomer: boolean;
  isReady: boolean;
}
interface Draft {
  id?: string;
  name: string;
  description: string;
  isDefault: boolean;
  stages: StageDraft[];
  productIds: string[];
}

const NEW_FLOW: Draft = {
  name: "",
  description: "",
  isDefault: false,
  stages: [
    { label: "Recibido", notifyCustomer: false, isReady: false },
    { label: "En proceso", notifyCustomer: false, isReady: false },
    { label: "Listo para entregar", notifyCustomer: true, isReady: true },
  ],
  productIds: [],
};

const fromFlow = (f: Flow): Draft => ({
  id: f.id,
  name: f.name,
  description: f.description ?? "",
  isDefault: f.isDefault,
  stages: f.stages.map((s) => ({ id: s.id, label: s.label, notifyCustomer: s.notifyCustomer, isReady: s.isReady })),
  productIds: f.productIds,
});

/** Editor de flujos: etapas en orden, cuál es «Listo», cuáles avisan al cliente y qué servicios las siguen. */
export function ServiceFlowsDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved: () => void }) {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [services, setServices] = useState<CatalogService[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [serviceQ, setServiceQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (selectId?: string) => {
    const [f, c] = await Promise.all([fetch("/api/service-orders/flows", { cache: "no-store" }).then((r) => r.json()), fetch("/api/service-orders/catalog", { cache: "no-store" }).then((r) => r.json())]);
    const list: Flow[] = f.flows ?? [];
    setFlows(list);
    setServices(c.services ?? []);
    const pick = list.find((x) => x.id === selectId) ?? list[0];
    setDraft(pick ? fromFlow(pick) : { ...NEW_FLOW });
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setServiceQ("");
    void load().catch(() => setError("No se pudieron cargar los flujos"));
  }, [open, load]);

  // Un servicio (producto) puede tener varias variantes; el flujo se asigna por producto.
  const products = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of services) map.set(s.productId, s.name);
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [services]);
  const visibleProducts = products.filter((p) => !serviceQ.trim() || matchesSearch(p.name, serviceQ));
  const takenBy = (productId: string) => flows.find((f) => f.id !== draft?.id && f.productIds.includes(productId))?.name;

  if (!draft) {
    return (
      <DialogComponent open={open} onOpenChange={onOpenChange} icon={<Settings2 className="size-5" />} title="Flujos y etapas" description="Cargando…">
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </DialogComponent>
    );
  }

  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const setStage = (i: number, patch: Partial<StageDraft>) => set({ stages: draft.stages.map((s, at) => (at === i ? { ...s, ...patch } : s)) });
  const moveStage = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= draft.stages.length) return;
    const next = [...draft.stages];
    [next[i], next[j]] = [next[j], next[i]];
    set({ stages: next });
  };
  const markReady = (i: number) => set({ stages: draft.stages.map((s, at) => ({ ...s, isReady: at === i, notifyCustomer: at === i ? true : s.notifyCustomer })) });
  const toggleProduct = (id: string) => set({ productIds: draft.productIds.includes(id) ? draft.productIds.filter((x) => x !== id) : [...draft.productIds, id] });

  const save = async () => {
    setError(null);
    if (!draft.name.trim()) return setError("Ponle nombre al flujo");
    if (draft.stages.filter((s) => s.label.trim()).length < 2) return setError("Un flujo necesita al menos dos etapas");
    if (!draft.stages.some((s) => s.isReady)) return setError("Marca cuál etapa significa «Listo para entregar»");
    setSaving(true);
    try {
      const res = await fetch("/api/service-orders/flows", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo guardar el flujo");
      toast.success("Flujo guardado");
      onSaved();
      await load(data.flow.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el flujo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogComponent
      open={open}
      onOpenChange={onOpenChange}
      icon={<Settings2 className="size-5" />}
      title="Flujos y etapas"
      description="Cada tipo de servicio puede seguir sus propias etapas (por ejemplo, lavado exterior o completo)."
      className="sm:max-w-2xl"
      footer={
        <>
          {error && <p className="mr-auto text-sm font-medium text-destructive">{error}</p>}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Guardar flujo
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <FormCombobox
            label="Flujo"
            value={draft.id ?? ""}
            onChange={(id) => {
              const f = flows.find((x) => x.id === id);
              if (f) setDraft(fromFlow(f));
            }}
            options={flows.map((f) => ({ value: f.id, label: f.name + (f.isDefault ? " (general)" : "") }))}
            placeholder="Flujo nuevo"
            clearable={false}
            searchable={false}
            className="min-w-56 flex-1"
          />
          <Button variant="outline" onClick={() => setDraft({ ...NEW_FLOW, stages: NEW_FLOW.stages.map((s) => ({ ...s })) })}>
            <Plus className="size-4" /> Nuevo flujo
          </Button>
        </div>

        <InputGroupField required label="Nombre del flujo" value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ej. Lavado completo" maxLength={80} />
        <SwitchField id="SwitchFlujoGeneral" label="Flujo general" description="Se usa cuando el servicio elegido no pertenece a ningún flujo." checked={draft.isDefault} onCheckedChange={(v) => set({ isDefault: v })} icon={<CheckCircle2 className="size-4" />} />

        <div className="space-y-2">
          <p className="text-sm font-medium">Etapas, en orden</p>
          <ol className="space-y-2">
            {draft.stages.map((s, i) => (
              <li key={s.id ?? `new-${i}`} className={cn("flex flex-wrap items-center gap-2 rounded-xl border p-2", s.isReady && "border-success/50 bg-success/5")}>
                <span className="w-5 text-center text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <InputGroupField label="Etapa" value={s.label} onChange={(e) => setStage(i, { label: e.target.value })} placeholder="Ej. Lavando" maxLength={60} containerClassName="min-w-40 flex-1" />
                <button type="button" onClick={() => markReady(i)} aria-pressed={s.isReady} title="Esta etapa significa «Listo para entregar»" className={cn("press inline-flex min-h-9 items-center gap-1 rounded-full border px-2.5 text-xs", s.isReady ? "border-success bg-success/15 text-success-ink" : "text-muted-foreground hover:bg-muted/50")}>
                  <CheckCircle2 className="size-3.5" /> Listo
                </button>
                <button type="button" disabled={s.isReady} onClick={() => setStage(i, { notifyCustomer: !s.notifyCustomer })} aria-pressed={s.notifyCustomer} title="Avisar al cliente al llegar a esta etapa" className={cn("press inline-flex min-h-9 items-center gap-1 rounded-full border px-2.5 text-xs", s.notifyCustomer ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50")}>
                  <Bell className="size-3.5" /> Avisar
                </button>
                <span className="ml-auto flex items-center">
                  <Button type="button" variant="ghost" size="icon" aria-label="Subir" disabled={i === 0} onClick={() => moveStage(i, -1)}>
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="Bajar" disabled={i === draft.stages.length - 1} onClick={() => moveStage(i, 1)}>
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="text-destructive" aria-label="Quitar etapa" disabled={draft.stages.length <= 2} onClick={() => set({ stages: draft.stages.filter((_, at) => at !== i) })}>
                    <Trash2 className="size-4" />
                  </Button>
                </span>
              </li>
            ))}
          </ol>
          <Button type="button" variant="outline" size="sm" onClick={() => set({ stages: [...draft.stages.slice(0, -1), { label: "", notifyCustomer: false, isReady: false }, draft.stages[draft.stages.length - 1]] })}>
            <Plus className="size-4" /> Agregar etapa
          </Button>
          <p className="text-xs text-muted-foreground">Las órdenes que ya están en una etapa que quites no se pierden: aparecen en «Otras etapas».</p>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="text-sm font-medium">Servicios que siguen este flujo</p>
            {products.length > 8 && <InputGroupField label="Buscar servicio" type="search" value={serviceQ} onChange={(e) => setServiceQ(e.target.value)} containerClassName="w-56" />}
          </div>
          {products.length === 0 ? (
            <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">Aún no hay servicios. Créalos en Productos sin control de inventario.</p>
          ) : (
            <ul className="grid max-h-48 gap-1.5 overflow-y-auto sm:grid-cols-2">
              {visibleProducts.map((p) => {
                const on = draft.productIds.includes(p.id);
                const other = takenBy(p.id);
                return (
                  <li key={p.id}>
                    <button type="button" aria-pressed={on} onClick={() => toggleProduct(p.id)} className={cn("press flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm", on ? "border-primary bg-primary/10" : "hover:bg-muted/50")}>
                      <span className="truncate">{p.name}</span>
                      {other && !on && <span className="shrink-0 text-xs text-muted-foreground">en «{other}»</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">Un servicio sigue un solo flujo; al elegirlo aquí se mueve desde el otro.</p>
        </div>
      </div>
    </DialogComponent>
  );
}
