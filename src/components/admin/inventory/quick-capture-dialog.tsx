"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Barcode, Keyboard, ListChecks, Loader2, Save, Search, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogComponent } from "@/components/ui/dialog";
import { InputGroupField } from "@/components/base/input-group-field";
import { SegmentedFilter } from "@/components/base";
import { inventoryApi, type InventoryRow } from "@/lib/api";
import { swalError, swalToast } from "@/lib/swal";
import { playSound } from "@/lib/sounds";
import { cn } from "@/lib/utils";

// Captura rápida de inventario.
// • Modo "Reemplazar": escribes la existencia contada.
// • Modo "Sumar": escribes lo que llegó y se suma a lo que hay.
// • Escáner: cada lectura suma 1 a la fila del producto (y la resalta).
// • Enter / ↓ / ↑ saltan de fila en la misma columna.
// • "Sugerir mínimos" calcula el mínimo con la venta de los últimos 30 días.

type Mode = "replace" | "add";
type Filter = "all" | "noMin" | "low" | "changed";
type Draft = Record<string, { quantity: string; minThreshold: string }>;

const num = (v: string) => (v.trim() === "" ? NaN : Number(v));
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, "").replace(/\.$/, ""));

export function QuickCaptureDialog({
  open,
  onOpenChange,
  rows,
  locationType,
  locationId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: InventoryRow[];
  locationType: string;
  locationId: string;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<Mode>("replace");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [scan, setScan] = useState("");
  const [draft, setDraft] = useState<Draft>({});
  const [velocity, setVelocity] = useState<Record<string, { daily: number; min: number }>>({});
  const [suggesting, setSuggesting] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [bulkMin, setBulkMin] = useState("");
  const [saving, setSaving] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const initial = (m: Mode): Draft =>
    Object.fromEntries(rows.map((r) => [r.id, { quantity: m === "replace" ? fmt(r.quantity) : "", minThreshold: fmt(r.minThreshold) }]));

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setScan("");
    setFilter("all");
    setMode("replace");
    setVelocity({});
    setDraft(initial("replace"));
    setTimeout(() => scanRef.current?.focus(), 150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rows]);

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    // Conserva los mínimos capturados, reinicia solo la columna de cantidad.
    setDraft((cur) => Object.fromEntries(rows.map((r) => [r.id, { quantity: m === "replace" ? fmt(r.quantity) : "", minThreshold: cur[r.id]?.minThreshold ?? fmt(r.minThreshold) }])));
    setMode(m);
  };

  /** Existencia final de la fila según el modo. */
  const finalQty = (r: InventoryRow) => {
    const v = draft[r.id]?.quantity ?? "";
    if (mode === "add") return r.quantity + (v.trim() === "" ? 0 : num(v));
    return v.trim() === "" ? r.quantity : num(v);
  };
  const finalMin = (r: InventoryRow) => {
    const v = draft[r.id]?.minThreshold ?? "";
    return v.trim() === "" ? r.minThreshold : num(v);
  };

  const changed = rows.filter((r) => finalQty(r) !== r.quantity || finalMin(r) !== r.minThreshold);
  const invalid = changed.some((r) => !Number.isFinite(finalQty(r)) || finalQty(r) < 0 || !Number.isFinite(finalMin(r)) || finalMin(r) < 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !`${r.productName} ${r.variantName ?? ""} ${r.sku ?? ""} ${r.barcode ?? ""}`.toLowerCase().includes(q)) return false;
      if (filter === "noMin") return r.minThreshold === 0;
      if (filter === "low") return r.minThreshold > 0 && r.quantity <= r.minThreshold;
      if (filter === "changed") return changed.some((c) => c.id === r.id);
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, filter, draft, mode]);

  const set = (id: string, field: "quantity" | "minThreshold", value: string) =>
    setDraft((cur) => ({ ...cur, [id]: { ...(cur[id] ?? { quantity: "", minThreshold: "" }), [field]: value } }));

  /** Navegación tipo hoja de cálculo. */
  const onCellKey = (e: React.KeyboardEvent<HTMLInputElement>, col: "q" | "m", index: number) => {
    const move = e.key === "Enter" || e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!move) return;
    e.preventDefault();
    const next = tableRef.current?.querySelector<HTMLInputElement>(`[data-cell="${col}-${index + move}"]`);
    if (next) {
      next.focus();
      next.select();
    } else if (move > 0) scanRef.current?.focus();
  };

  /** Lectura del escáner (o código escrito + Enter): suma 1 a la fila. */
  const onScan = () => {
    const code = scan.trim().toLowerCase();
    if (!code) return;
    const row =
      rows.find((r) => r.barcode?.toLowerCase() === code || r.sku?.toLowerCase() === code) ??
      rows.find((r) => `${r.productName} ${r.variantName ?? ""}`.toLowerCase().includes(code));
    setScan("");
    if (!row) {
      playSound("error");
      swalToast(`Sin coincidencia para "${code}"`, "warning");
      return;
    }
    playSound("scan");
    setDraft((cur) => {
      const v = cur[row.id]?.quantity ?? "";
      const base = v.trim() === "" ? (mode === "replace" ? row.quantity : 0) : num(v);
      return { ...cur, [row.id]: { ...(cur[row.id] ?? { minThreshold: fmt(row.minThreshold) }), quantity: fmt((Number.isFinite(base) ? base : 0) + 1) } };
    });
    setFlash(row.id);
    setTimeout(() => setFlash((f) => (f === row.id ? null : f)), 900);
    if (filter !== "all" || query) {
      setFilter("all");
      setQuery("");
    }
    setTimeout(() => tableRef.current?.querySelector(`[data-row="${row.id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
  };

  const suggestMins = async () => {
    setSuggesting(true);
    try {
      const res = await inventoryApi.velocity({ locationType, locationId, coverage: 7 });
      const map = Object.fromEntries(res.rows.map((r) => [r.inventoryId, { daily: r.dailyAverage, min: r.suggestedMin }]));
      setVelocity(map);
      const withSales = res.rows.filter((r) => r.suggestedMin > 0);
      if (!withSales.length) {
        swalToast("Aún no hay ventas suficientes en esta ubicación para sugerir mínimos", "info");
        return;
      }
      setDraft((cur) => {
        const next = { ...cur };
        for (const r of withSales) if (next[r.inventoryId]) next[r.inventoryId] = { ...next[r.inventoryId], minThreshold: String(r.suggestedMin) };
        return next;
      });
      swalToast(`Mínimo sugerido en ${withSales.length} productos (7 días de venta)`);
    } catch (error) {
      swalError("No se pudo calcular", error instanceof Error ? error.message : undefined);
    } finally {
      setSuggesting(false);
    }
  };

  const applyBulkMin = () => {
    const v = num(bulkMin);
    if (!Number.isFinite(v) || v < 0) return;
    setDraft((cur) => {
      const next = { ...cur };
      for (const r of filtered) if (r.minThreshold === 0 && num(next[r.id]?.minThreshold ?? "0") === 0) next[r.id] = { ...next[r.id], minThreshold: fmt(v) };
      return next;
    });
    setBulkMin("");
  };

  const save = async () => {
    setSaving(true);
    try {
      await inventoryApi.bulkUpdate(changed.map((r) => ({ inventoryId: r.id, quantity: finalQty(r), minThreshold: finalMin(r) })));
      swalToast(`${changed.length} productos actualizados`);
      onOpenChange(false);
      onDone();
    } catch (error) {
      swalError("No se pudo guardar", error instanceof Error ? error.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const noMinCount = rows.filter((r) => r.minThreshold === 0).length;
  const lowCount = rows.filter((r) => r.minThreshold > 0 && r.quantity <= r.minThreshold).length;

  return (
    <DialogComponent
      open={open}
      onOpenChange={onOpenChange}
      icon={<ListChecks className="size-5" />}
      title="Captura rápida de inventario"
      description="Escanea, escribe y avanza con Enter. Solo se guardan las filas que cambian."
      size="full"
      bodyClassName="space-y-3"
      footer={
        <>
          <span className="mr-auto text-sm text-muted-foreground">
            <b className="text-foreground tabular-nums">{changed.length}</b> cambios
          </span>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => void save()} disabled={!changed.length || invalid || saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Guardar cambios
          </Button>
        </>
      }
    >
      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedFilter
            ariaLabel="Modo de captura"
            value={mode}
            onChange={switchMode}
            options={[
              { value: "replace", label: "Conteo (reemplazar)" },
              { value: "add", label: "Entrada (sumar)" },
            ]}
          />
          <InputGroupField
            ref={scanRef}
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onScan();
              }
            }}
            placeholder="Escanea o escribe el código y Enter (+1)"
            leftIcon={<Barcode className="size-4" />}
            className="w-72"
            aria-label="Escanear código"
          />
          <InputGroupField value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrar por nombre, SKU…" leftIcon={<Search className="size-4" />} className="w-56" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void suggestMins()} disabled={suggesting} title="Venta promedio diaria de los últimos 30 días × 7 días de cobertura">
            {suggesting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Sugerir mínimos por ventas
          </Button>
          <div className="flex items-center gap-1">
            <Input value={bulkMin} onChange={(e) => setBulkMin(e.target.value)} type="number" min="0" placeholder="Mín." className="h-8 w-20" aria-label="Mínimo para los que no tienen" />
            <Button variant="outline" size="sm" onClick={applyBulkMin} disabled={!bulkMin} title="Aplica este mínimo a los productos (visibles) que no tienen uno">
              <Wand2 className="size-4" /> A los sin mínimo
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <SegmentedFilter
          ariaLabel="Filtrar filas"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Todos", count: rows.length },
            { value: "noMin", label: "Sin mínimo", count: noMinCount, countTone: "warning" },
            { value: "low", label: "En su mínimo", count: lowCount, countTone: "danger" },
            { value: "changed", label: "Modificados", count: changed.length },
          ]}
        />
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Keyboard className="size-3.5" /> Enter o ↓ baja a la siguiente fila · ↑ sube
        </p>
      </div>

      <div ref={tableRef} className="max-h-[58vh] overflow-auto rounded-xl border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="sticky top-0 z-10 bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Producto</th>
              <th className="w-28 px-3 py-2 text-right">Actual</th>
              <th className="w-40 px-3 py-2 text-left">{mode === "replace" ? "Existencia contada" : "Cantidad que entra"}</th>
              <th className="w-28 px-3 py-2 text-right">Resultado</th>
              <th className="w-44 px-3 py-2 text-left">Mínimo</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, index) => {
              const d = draft[r.id] ?? { quantity: "", minThreshold: "" };
              const q = finalQty(r);
              const diff = Number.isFinite(q) ? q - r.quantity : 0;
              const minChanged = finalMin(r) !== r.minThreshold;
              const v = velocity[r.id];
              const unit = r.unit ?? "pza";
              return (
                <tr
                  key={r.id}
                  data-row={r.id}
                  className={cn(
                    "border-t transition-colors",
                    (diff !== 0 || minChanged) && "bg-primary/5",
                    flash === r.id && "bg-success/20"
                  )}
                >
                  <td className="px-3 py-2">
                    <p className="font-medium">{r.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {[r.variantName && r.variantName !== "Default" ? r.variantName : null, r.sku, r.barcode].filter(Boolean).join(" · ") || (r.productType === "bulk" ? "A granel" : "—")}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {fmt(r.quantity)} <span className="text-xs">{unit}</span>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      data-cell={`q-${index}`}
                      type="number"
                      min="0"
                      step="0.001"
                      inputMode="decimal"
                      value={d.quantity}
                      placeholder={mode === "add" ? "0" : fmt(r.quantity)}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => set(r.id, "quantity", e.target.value)}
                      onKeyDown={(e) => onCellKey(e, "q", index)}
                      aria-label={`${mode === "replace" ? "Existencia" : "Entrada"} de ${r.productName}`}
                      className="h-8 tabular-nums"
                    />
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className="font-semibold">{Number.isFinite(q) ? fmt(q) : "—"}</span>
                    {diff !== 0 && Number.isFinite(diff) && (
                      <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-semibold", diff > 0 ? "bg-success/15 text-success-ink" : "bg-destructive/10 text-destructive")}>
                        {diff > 0 ? "+" : "−"}
                        {fmt(Math.abs(diff))}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      data-cell={`m-${index}`}
                      type="number"
                      min="0"
                      step="0.001"
                      inputMode="decimal"
                      value={d.minThreshold}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => set(r.id, "minThreshold", e.target.value)}
                      onKeyDown={(e) => onCellKey(e, "m", index)}
                      aria-label={`Mínimo de ${r.productName}`}
                      className={cn("h-8 tabular-nums", minChanged && "border-primary")}
                    />
                    {v && v.daily > 0 && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Vende ~{fmt(v.daily)} {unit}/día
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-sm text-muted-foreground">
                  Nada que mostrar con este filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {invalid && <p role="alert" className="text-sm text-destructive">Hay cantidades negativas o no numéricas; corrígelas antes de guardar.</p>}
    </DialogComponent>
  );
}
