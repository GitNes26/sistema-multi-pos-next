"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Gift, Loader2, Package, Pencil, Plus, Repeat2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { DialogComponent } from "@/components/ui/dialog";
import { FormCombobox } from "@/components/base/form-combobox";
import { InputGroupField } from "@/components/base/input-group-field";
import { TextareaField } from "@/components/base/textarea-field";
import { EmptyState } from "@/components/shared/empty-state";
import { LOYALTY_KIND_LABEL, LOYALTY_PRESETS, presetByKey, type LoyaltyKind, type LoyaltyPreset } from "@/lib/loyalty/presets";
import { matchesSearch } from "@/lib/search";
import { swalError, swalToast } from "@/lib/swal";
import { cn } from "@/lib/utils";

interface Program {
  id: string;
  kind: LoyaltyKind;
  presetKey: string | null;
  name: string;
  description: string | null;
  isActive: boolean;
  visitsRequired: number | null;
  packUses: number | null;
  packProductId: string | null;
  packProductName: string | null;
  targetProductIds: string[];
  targetProductNames: string[];
  discountPercent: number;
  periodDays: number | null;
  rollover: boolean;
  reminderDays: number;
  terms: string | null;
  customersWithCredits: number;
  creditsOutstanding: number;
  activeMembers: number;
}
interface ProductOption {
  id: string;
  name: string;
  trackInventory: boolean;
}
interface Draft {
  id: string | null;
  kind: LoyaltyKind;
  presetKey: string | null;
  name: string;
  description: string;
  visitsRequired: string;
  packUses: string;
  packProductId: string;
  targetProductIds: string[];
  discountPercent: string;
  periodDays: string;
  rollover: boolean;
  reminderDays: string;
  terms: string;
}

const draftFromPreset = (p: LoyaltyPreset): Draft => ({
  id: null, kind: p.kind, presetKey: p.key, name: p.name, description: "",
  visitsRequired: p.visitsRequired ? String(p.visitsRequired) : "", packUses: p.packUses ? String(p.packUses) : "",
  packProductId: "", targetProductIds: [], discountPercent: String(p.discountPercent),
  periodDays: p.periodDays ? String(p.periodDays) : "30", rollover: Boolean(p.rollover), reminderDays: String(p.reminderDays ?? 3), terms: p.terms ?? "",
});
const blankDraft = (kind: LoyaltyKind): Draft => ({
  id: null, kind, presetKey: null, name: "", description: "", visitsRequired: kind === "visit_card" ? "5" : "", packUses: kind === "visit_card" ? "" : kind === "membership" ? "4" : "5",
  packProductId: "", targetProductIds: [], discountPercent: "100",
  periodDays: "30", rollover: false, reminderDays: "3", terms: "",
});
const draftFromProgram = (p: Program): Draft => ({
  id: p.id, kind: p.kind, presetKey: p.presetKey, name: p.name, description: p.description ?? "",
  visitsRequired: p.visitsRequired ? String(p.visitsRequired) : "", packUses: p.packUses ? String(p.packUses) : "",
  packProductId: p.packProductId ?? "", targetProductIds: p.targetProductIds, discountPercent: String(p.discountPercent),
  periodDays: p.periodDays ? String(p.periodDays) : "30", rollover: p.rollover, reminderDays: String(p.reminderDays), terms: p.terms ?? "",
});

function summary(p: Program): string {
  const reward = p.discountPercent >= 100 ? "gratis" : `${p.discountPercent}% de descuento`;
  const scope = p.targetProductNames.length ? p.targetProductNames.join(", ") : "cualquier producto o servicio";
  if (p.kind === "membership") {
    return `Cuota «${p.packProductName ?? "de la membresía"}»: cada ${p.periodDays} días el cliente recibe ${p.packUses} servicio(s) (${reward}) en ${scope}. ${p.rollover ? "Los que no use se acumulan si renueva a tiempo." : "Los que no use no se acumulan."} Avisamos ${p.reminderDays} día(s) antes de vencer.`;
  }
  return p.kind === "visit_card"
    ? `Cada ${p.visitsRequired} compras de ${scope}, el cliente gana un servicio ${reward}.`
    : `Al comprar «${p.packProductName ?? "el paquete"}» el cliente recibe ${p.packUses} servicios (${reward}) para canjear en ${scope}.`;
}

/** Programas de fidelidad: el dueño elige una opción precargada y la ajusta a su gusto. */
export function LoyaltyProgramsClient({ canManage }: { canManage: boolean }) {
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/loyalty-programs", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "No se pudieron cargar los programas");
      setPrograms(json.programs);
      setProducts(json.products);
    } catch (err) {
      setPrograms((prev) => prev ?? []);
      swalError("No se pudieron cargar los programas", err instanceof Error ? err.message : undefined);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleProducts = useMemo(() => products.filter((p) => matchesSearch(p.name, search)), [products, search]);
  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        kind: draft.kind, presetKey: draft.presetKey, name: draft.name, description: draft.description,
        visitsRequired: draft.kind === "visit_card" ? Number(draft.visitsRequired) : undefined,
        packUses: draft.kind !== "visit_card" ? Number(draft.packUses) : undefined,
        packProductId: draft.kind !== "visit_card" ? draft.packProductId || null : undefined,
        ...(draft.kind === "membership" ? { periodDays: Number(draft.periodDays), rollover: draft.rollover, reminderDays: Number(draft.reminderDays), terms: draft.terms } : {}),
        targetProductIds: draft.targetProductIds, discountPercent: Number(draft.discountPercent),
      };
      const res = await fetch(draft.id ? `/api/loyalty-programs/${draft.id}` : "/api/loyalty-programs", {
        method: draft.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "No se pudo guardar");
      swalToast(draft.id ? "Programa actualizado" : "Programa activado");
      setDraft(null);
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (p: Program, isActive: boolean) => {
    const res = await fetch(`/api/loyalty-programs/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) return swalError("No se pudo cambiar", json.error);
    swalToast(isActive ? "Programa activado" : "Programa pausado: los créditos de los clientes se conservan");
    void load();
  };

  if (programs === null) return <Skeleton className="h-40 rounded-2xl" />;
  const preset = presetByKey(draft?.presetKey);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Elige una opción ya preparada, ajústala a tu negocio (cuántas visitas, qué servicios, cuánto cubre cada premio) y actívala. Los clientes ganan créditos y el cajero los canjea en el cobro.
        </p>
        {canManage && (
          <Button onClick={() => setPicking(true)}>
            <Plus className="size-4" /> Agregar programa
          </Button>
        )}
      </div>

      {programs.length === 0 ? (
        <EmptyState icon={Gift} title="Aún no tienes programas de fidelidad" description="Activa una opción precargada para premiar a tus clientes frecuentes." action={canManage ? <Button onClick={() => setPicking(true)}><Plus className="size-4" /> Ver opciones</Button> : undefined} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {programs.map((p) => (
            <article key={p.id} className={cn("space-y-3 rounded-2xl border bg-card p-4", !p.isActive && "opacity-70")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{p.name}</h3>
                  <Badge variant="secondary" className="mt-1">{LOYALTY_KIND_LABEL[p.kind]}</Badge>
                </div>
                {canManage && <Switch checked={p.isActive} onCheckedChange={(v) => void toggle(p, v)} aria-label={`Programa ${p.isActive ? "activo" : "pausado"}`} />}
              </div>
              <p className="text-sm text-muted-foreground">{summary(p)}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {p.kind === "membership" ? `${p.activeMembers} miembro(s) con membresía vigente · ` : ""}{p.creditsOutstanding > 0 ? `${p.creditsOutstanding} créditos pendientes en ${p.customersWithCredits} cliente(s)` : "Sin créditos pendientes"}
              </p>
              {canManage && (
                <Button variant="outline" size="sm" onClick={() => { setError(null); setDraft(draftFromProgram(p)); }}>
                  <Pencil className="size-4" /> Configurar
                </Button>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Elegir opción precargada */}
      <DialogComponent
        open={picking}
        onOpenChange={setPicking}
        icon={<Sparkles className="size-5 text-primary" />}
        title="Elige una opción"
        description="Son puntos de partida: en el siguiente paso puedes cambiar todo."
        className="sm:max-w-2xl"
        bodyClassName="space-y-3"
        footer={<Button variant="ghost" onClick={() => setPicking(false)}>Cerrar</Button>}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {LOYALTY_PRESETS.map((p) => (
            <button key={p.key} type="button" className="press space-y-1 rounded-xl border bg-card p-3 text-left hover:border-primary/50" onClick={() => { setPicking(false); setError(null); setDraft(draftFromPreset(p)); }}>
              <span className="flex items-center gap-2 text-sm font-semibold">
                {p.kind === "visit_card" ? <Repeat2 className="size-4 text-primary" /> : p.kind === "membership" ? <CalendarClock className="size-4 text-primary" /> : <Package className="size-4 text-primary" />} {p.name}
              </span>
              <span className="block text-xs text-muted-foreground">{p.blurb}</span>
            </button>
          ))}
          <button type="button" className="press space-y-1 rounded-xl border border-dashed p-3 text-left hover:border-primary/50" onClick={() => { setPicking(false); setError(null); setDraft(blankDraft("visit_card")); }}>
            <span className="flex items-center gap-2 text-sm font-semibold"><Plus className="size-4" /> Tarjeta de visitas a mi manera</span>
            <span className="block text-xs text-muted-foreground">Empieza en blanco.</span>
          </button>
          <button type="button" className="press space-y-1 rounded-xl border border-dashed p-3 text-left hover:border-primary/50" onClick={() => { setPicking(false); setError(null); setDraft(blankDraft("membership")); }}>
            <span className="flex items-center gap-2 text-sm font-semibold"><Plus className="size-4" /> Membresía a mi manera</span>
            <span className="block text-xs text-muted-foreground">Cuota periódica con vigencia. Empieza en blanco.</span>
          </button>
          <button type="button" className="press space-y-1 rounded-xl border border-dashed p-3 text-left hover:border-primary/50" onClick={() => { setPicking(false); setError(null); setDraft(blankDraft("prepaid_pack")); }}>
            <span className="flex items-center gap-2 text-sm font-semibold"><Plus className="size-4" /> Paquete prepagado a mi manera</span>
            <span className="block text-xs text-muted-foreground">Empieza en blanco.</span>
          </button>
        </div>
      </DialogComponent>

      {/* Configurar */}
      <DialogComponent
        open={draft !== null}
        onOpenChange={(o) => !o && setDraft(null)}
        icon={draft?.kind === "visit_card" ? <Repeat2 className="size-5 text-primary" /> : draft?.kind === "membership" ? <CalendarClock className="size-5 text-primary" /> : <Package className="size-5 text-primary" />}
        title={draft?.id ? "Configurar programa" : "Activar programa"}
        description={preset ? preset.blurb : draft?.kind === "visit_card" ? "Tarjeta de visitas: cada N compras, un premio." : draft?.kind === "membership" ? "Membresía: una cuota por periodo con servicios incluidos y vigencia." : "Paquete prepagado: el cliente paga por adelantado varios servicios."}
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
            <InputGroupField label="Nombre del programa" required value={draft.name} onChange={(e) => set({ name: e.target.value })} helper="Lo ven tus cajeros y tus clientes." />
            {draft.kind === "visit_card" ? (
              <InputGroupField label="Compras necesarias para ganar un premio" required type="number" inputMode="numeric" min={2} max={100} value={draft.visitsRequired} onChange={(e) => set({ visitsRequired: e.target.value })} helper="Cada venta con un servicio del programa cuenta como una visita." />
            ) : (
              <>
                <InputGroupField label={draft.kind === "membership" ? "Servicios incluidos en cada periodo" : "Servicios que incluye el paquete"} required type="number" inputMode="numeric" min={1} max={100} value={draft.packUses} onChange={(e) => set({ packUses: e.target.value })} />
                <FormCombobox
                  label={draft.kind === "membership" ? "Producto que es la cuota de la membresía" : "Producto que se vende como paquete"}
                  required
                  value={draft.packProductId}
                  onChange={(v) => set({ packProductId: v })}
                  options={products.map((p) => ({ value: p.id, label: p.name }))}
                  placeholder="Elige el producto del catálogo…"
                  helper={draft.kind === "membership" ? "Créalo en el catálogo con el precio de la cuota (por ejemplo «Membresía mensual $400»). Cada vez que se cobre en el POS a un cliente, se da de alta o se renueva su periodo." : "Créalo en el catálogo con el precio del paquete (por ejemplo «Paquete 5 lavados»). Al venderlo en el POS, el cliente recibe sus créditos."}
                />
              </>
            )}
            {draft.kind === "membership" && (
              <div className="space-y-4 rounded-xl border bg-muted/30 p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <InputGroupField label="Días de cada periodo" required type="number" inputMode="numeric" min={1} max={366} value={draft.periodDays} onChange={(e) => set({ periodDays: e.target.value })} helper="30 = mensual, 7 = semanal, 365 = anual." />
                  <InputGroupField label="Avisar antes de vencer" type="number" inputMode="numeric" min={0} max={60} rightAddon="días" value={draft.reminderDays} onChange={(e) => set({ reminderDays: e.target.value })} helper="El cliente recibe un aviso en su portal. 0 = sin aviso." />
                </div>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <Switch checked={draft.rollover} onCheckedChange={(v) => set({ rollover: v })} aria-label="Acumular servicios sin usar" />
                  <span>
                    <span className="font-medium">Los servicios sin usar pasan al siguiente periodo</span>
                    <span className="block text-xs text-muted-foreground">Solo si el cliente renueva antes de que venza. Si vence, se pierden.</span>
                  </span>
                </label>
                <TextareaField label="Condiciones y políticas" value={draft.terms} onChange={(e) => set({ terms: e.target.value })} rows={3} placeholder="Lo que debe saber el cliente: vigencia, si es personal, qué no incluye…" helper="El cliente lo ve en su portal junto a su membresía." />
              </div>
            )}
            <InputGroupField label="Qué parte del servicio cubre cada crédito" required type="number" inputMode="numeric" min={1} max={100} rightAddon="%" value={draft.discountPercent} onChange={(e) => set({ discountPercent: e.target.value })} helper="100 = el servicio sale gratis; 50 = a mitad de precio." />
            <div className="space-y-2">
              <p className="text-sm font-medium">A qué productos o servicios aplica</p>
              <p className="text-xs text-muted-foreground">
                {draft.kind === "visit_card" ? "Los que suman visitas y se pueden canjear." : "Los que se pueden pagar con créditos."} Sin marcar ninguno aplica a cualquiera.
              </p>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto o servicio…" aria-label="Buscar producto o servicio" />
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border p-2">
                {visibleProducts.length === 0 && <p className="p-2 text-xs text-muted-foreground">Sin coincidencias.</p>}
                {visibleProducts.map((p) => {
                  const on = draft.targetProductIds.includes(p.id);
                  return (
                    <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60">
                      <Checkbox checked={on} onCheckedChange={(v) => set({ targetProductIds: v ? [...draft.targetProductIds, p.id] : draft.targetProductIds.filter((id) => id !== p.id) })} />
                      <span className="truncate">{p.name}</span>
                      {!p.trackInventory && <span className="ml-auto text-xs text-muted-foreground">servicio</span>}
                    </label>
                  );
                })}
              </div>
              {draft.targetProductIds.length > 0 && <p className="text-xs text-muted-foreground">{draft.targetProductIds.length} seleccionado(s)</p>}
            </div>
            <TextareaField label="Descripción" value={draft.description} onChange={(e) => set({ description: e.target.value })} rows={2} placeholder="Opcional: cómo se lo explicas al cliente" />
          </>
        )}
      </DialogComponent>
    </div>
  );
}
