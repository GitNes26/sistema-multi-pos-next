"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { DialogComponent } from "@/components/ui/dialog";
import { InputGroupField } from "@/components/base/input-group-field";
import { TextareaField } from "@/components/base/textarea-field";
import { EmptyState } from "@/components/shared/empty-state";
import { WARRANTY_PRESETS, warrantyLegendText, type WarrantyPreset } from "@/lib/warranty/presets";
import { matchesSearch } from "@/lib/search";
import { swalError, swalToast } from "@/lib/swal";
import { cn } from "@/lib/utils";

interface Rule {
  id: string;
  presetKey: string | null;
  name: string;
  isActive: boolean;
  appliesToProductIds: string[];
  appliesToProductNames: string[];
  coversProductIds: string[];
  coversProductNames: string[];
  windowHours: number;
  sameDayOnly: boolean;
  discountPercent: number;
  legend: string | null;
  legendPreview: string;
  used: number;
  requested: number;
}
interface Draft {
  id: string | null;
  presetKey: string | null;
  name: string;
  appliesToProductIds: string[];
  coversProductIds: string[];
  windowHours: string;
  sameDayOnly: boolean;
  discountPercent: string;
  legend: string;
}

const fromPreset = (p: WarrantyPreset): Draft => ({ id: null, presetKey: p.key, name: p.name, appliesToProductIds: [], coversProductIds: [], windowHours: String(p.windowHours), sameDayOnly: p.sameDayOnly, discountPercent: String(p.discountPercent), legend: "" });
const blank = (): Draft => ({ id: null, presetKey: null, name: "", appliesToProductIds: [], coversProductIds: [], windowHours: "24", sameDayOnly: false, discountPercent: "100", legend: "" });
const fromRule = (r: Rule): Draft => ({ id: r.id, presetKey: r.presetKey, name: r.name, appliesToProductIds: r.appliesToProductIds, coversProductIds: r.coversProductIds, windowHours: String(r.windowHours), sameDayOnly: r.sameDayOnly, discountPercent: String(r.discountPercent), legend: r.legend ?? "" });

function ProductChecklist({ label, helper, products, value, onChange }: { label: string; helper: string; products: { id: string; name: string }[]; value: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState("");
  const visible = useMemo(() => products.filter((p) => matchesSearch(p.name, q)), [products, q]);
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{helper}</p>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar servicio…" aria-label={`Buscar: ${label}`} />
      <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border p-2">
        {visible.length === 0 && <p className="p-2 text-xs text-muted-foreground">Sin coincidencias.</p>}
        {visible.map((p) => (
          <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60">
            <Checkbox checked={value.includes(p.id)} onCheckedChange={(v) => onChange(v ? [...value, p.id] : value.filter((id) => id !== p.id))} />
            <span className="truncate">{p.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

/** Garantías de servicio: opcionales, las define el dueño (plazo, porcentaje, servicios y leyenda del ticket). */
export function WarrantyRulesClient({ canManage }: { canManage: boolean }) {
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/warranty-rules", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "No se pudieron cargar las garantías");
      setRules(json.rules);
      setProducts(json.products);
    } catch (err) {
      setRules((prev) => prev ?? []);
      swalError("No se pudieron cargar las garantías", err instanceof Error ? err.message : undefined);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const body = { presetKey: draft.presetKey, name: draft.name, appliesToProductIds: draft.appliesToProductIds, coversProductIds: draft.coversProductIds, windowHours: Number(draft.windowHours), sameDayOnly: draft.sameDayOnly, discountPercent: Number(draft.discountPercent), legend: draft.legend };
      const res = await fetch(draft.id ? `/api/warranty-rules/${draft.id}` : "/api/warranty-rules", { method: draft.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "No se pudo guardar");
      swalToast(draft.id ? "Garantía actualizada" : "Garantía activada: ya aparece en los tickets");
      setDraft(null);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (r: Rule, isActive: boolean) => {
    const res = await fetch(`/api/warranty-rules/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) return swalError("No se pudo cambiar", json.error);
    swalToast(isActive ? "Garantía activada: ya aparece en los tickets" : "Garantía pausada: deja de aparecer en los tickets");
    void load();
  };

  if (rules === null) return <Skeleton className="h-40 rounded-2xl" />;

  const previewLegend = draft ? warrantyLegendText({ name: draft.name || "Garantía", windowHours: Number(draft.windowHours) || 24, sameDayOnly: draft.sameDayOnly, discountPercent: Number(draft.discountPercent) || 100, legend: draft.legend }) : "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Las garantías son opcionales: solo existen si tú las activas. Mientras una esté activa, el ticket de los servicios que cubre lleva su leyenda y el cajero puede canjearla con el número del ticket (el cliente también puede pedirla desde su portal).
        </p>
        {canManage && (
          <Button onClick={() => setPicking(true)}>
            <Plus className="size-4" /> Agregar garantía
          </Button>
        )}
      </div>

      {rules.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="No ofreces garantías de servicio" description="Si quieres, activa una opción (por ejemplo «lluvia el mismo día» en un autolavado) y ajústala a tus reglas." action={canManage ? <Button onClick={() => setPicking(true)}><Plus className="size-4" /> Ver opciones</Button> : undefined} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rules.map((r) => (
            <article key={r.id} className={cn("space-y-3 rounded-2xl border bg-card p-4", !r.isActive && "opacity-70")}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="flex items-center gap-1.5 font-semibold"><ShieldCheck className="size-4 text-primary" /> {r.name}</h3>
                {canManage && <Switch checked={r.isActive} onCheckedChange={(v) => void toggle(r, v)} aria-label={`Garantía ${r.isActive ? "activa" : "pausada"}`} />}
              </div>
              <p className="text-sm text-muted-foreground">
                {r.sameDayOnly ? "El mismo día de la venta" : `Hasta ${r.windowHours} h después`} · {r.discountPercent >= 100 ? "sin costo" : `${r.discountPercent}% de descuento`} · cubre {r.appliesToProductNames.length ? r.appliesToProductNames.join(", ") : "cualquier servicio"}
                {r.coversProductNames.length > 0 && <> · se repite: {r.coversProductNames.join(", ")}</>}
              </p>
              <p className="rounded-xl bg-muted/50 p-2.5 text-xs">Ticket: {r.legendPreview}</p>
              <p className="text-xs tabular-nums text-muted-foreground">{r.used} canjeada(s){r.requested > 0 ? ` · ${r.requested} pedida(s) por clientes sin canjear` : ""}</p>
              {canManage && (
                <Button variant="outline" size="sm" onClick={() => { setError(null); setDraft(fromRule(r)); }}>
                  <Pencil className="size-4" /> Configurar
                </Button>
              )}
            </article>
          ))}
        </div>
      )}

      <DialogComponent
        open={picking}
        onOpenChange={setPicking}
        icon={<Sparkles className="size-5 text-primary" />}
        title="Elige una garantía"
        description="Son puntos de partida: en el siguiente paso puedes cambiar plazo, porcentaje, servicios y leyenda."
        className="sm:max-w-xl"
        bodyClassName="space-y-2"
        footer={<Button variant="ghost" onClick={() => setPicking(false)}>Cerrar</Button>}
      >
        {WARRANTY_PRESETS.map((p) => (
          <button key={p.key} type="button" className="press block w-full space-y-1 rounded-xl border bg-card p-3 text-left hover:border-primary/50" onClick={() => { setPicking(false); setError(null); setDraft(fromPreset(p)); }}>
            <span className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-primary" /> {p.name}</span>
            <span className="block text-xs text-muted-foreground">{p.blurb}</span>
          </button>
        ))}
        <button type="button" className="press block w-full space-y-1 rounded-xl border border-dashed p-3 text-left hover:border-primary/50" onClick={() => { setPicking(false); setError(null); setDraft(blank()); }}>
          <span className="flex items-center gap-2 text-sm font-semibold"><Plus className="size-4" /> Una garantía a mi manera</span>
          <span className="block text-xs text-muted-foreground">Empieza en blanco.</span>
        </button>
      </DialogComponent>

      <DialogComponent
        open={draft !== null}
        onOpenChange={(o) => !o && setDraft(null)}
        icon={<ShieldCheck className="size-5 text-primary" />}
        title={draft?.id ? "Configurar garantía" : "Activar garantía"}
        description="Define cuándo aplica, cuánto cubre y qué leerá el cliente en su ticket."
        className="sm:max-w-xl"
        bodyClassName="space-y-4"
        footer={
          <>
            {error && <p className="mr-auto text-sm font-medium text-destructive">{error}</p>}
            <Button variant="ghost" onClick={() => setDraft(null)}>Cancelar</Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />} {draft?.id ? "Guardar" : "Activar"}
            </Button>
          </>
        }
      >
        {draft && (
          <>
            <InputGroupField label="Nombre de la garantía" required value={draft.name} onChange={(e) => set({ name: e.target.value })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <InputGroupField label="Horas de vigencia" required type="number" inputMode="numeric" min={1} max={720} rightAddon="h" value={draft.windowHours} onChange={(e) => set({ windowHours: e.target.value })} helper="Contadas desde que se cobró el servicio." />
              <InputGroupField label="Qué parte cubre" required type="number" inputMode="numeric" min={1} max={100} rightAddon="%" value={draft.discountPercent} onChange={(e) => set({ discountPercent: e.target.value })} helper="100 = se repite sin costo; 50 = a mitad de precio." />
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <Switch checked={draft.sameDayOnly} onCheckedChange={(v) => set({ sameDayOnly: v })} aria-label="Solo el mismo día" />
              <span>
                <span className="font-medium">Solo el mismo día del servicio</span>
                <span className="block text-xs text-muted-foreground">Útil para «si llueve hoy». Además del plazo en horas.</span>
              </span>
            </label>
            <ProductChecklist label="Servicios que tienen esta garantía" helper="Sin marcar ninguno aplica a cualquier servicio." products={products} value={draft.appliesToProductIds} onChange={(ids) => set({ appliesToProductIds: ids })} />
            <ProductChecklist label="Qué se puede repetir con la garantía" helper="Sin marcar ninguno se repite el mismo servicio del ticket. Marca, por ejemplo, solo «Lavado exterior»." products={products} value={draft.coversProductIds} onChange={(ids) => set({ coversProductIds: ids })} />
            <TextareaField label="Leyenda del ticket (opcional)" value={draft.legend} onChange={(e) => set({ legend: e.target.value })} rows={3} placeholder="Si lo dejas vacío se arma sola con las condiciones." helper="Así la verá el cliente en su ticket." />
            <p className="rounded-xl bg-muted/50 p-2.5 text-xs"><span className="font-medium">Vista previa del ticket:</span> {previewLegend}</p>
          </>
        )}
      </DialogComponent>
    </div>
  );
}
