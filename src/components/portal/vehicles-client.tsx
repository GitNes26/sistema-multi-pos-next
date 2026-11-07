"use client";

import { useCallback, useEffect, useState } from "react";
import { Car, Check, Clock, Loader2, Plus, Trash2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InputGroupField } from "@/components/base/input-group-field";
import { EmptyState } from "@/components/shared/empty-state";
import { useLiveStream } from "@/hooks/use-live-stream";
import { useVisibleInterval } from "@/hooks/use-visible-interval";
import { swalConfirm, swalError, swalToast } from "@/lib/swal";
import { cn } from "@/lib/utils";

interface Asset {
  id: string;
  label: string;
  reference: string | null;
  size: string | null;
}
interface PortalOrder {
  id: string;
  number: number;
  status: string;
  statusLabel: string;
  asset: { label: string; reference: string | null } | null;
  services: string[];
  stage: string;
  steps: { label: string; state: "done" | "current" | "todo" }[];
  total: number;
  promisedAt: string | null;
  createdAt: string;
}

const money = (n: number) => n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
const time = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

/** Mis vehículos y el seguimiento en vivo de mis servicios. */
export function VehiclesClient() {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [orders, setOrders] = useState<PortalOrder[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: "", reference: "", size: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/portal/vehicles", { cache: "no-store", credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo cargar");
      setAssets(data.assets);
      setOrders(data.orders);
    } catch {
      setAssets((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  // Cuando el negocio mueve una de mis órdenes, la barra de avance se actualiza sola.
  useLiveStream("/api/portal/vehicles/stream", () => void load());
  useVisibleInterval(() => void load(), 60_000);

  const add = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/portal/vehicles", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo guardar el vehículo");
      setAssets((prev) => [data.asset, ...(prev ?? [])]);
      setForm({ label: "", reference: "", size: "" });
      setAdding(false);
      swalToast("Vehículo guardado");
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (asset: Asset) => {
    if (!(await swalConfirm(`¿Quitar ${asset.label}?`, "Tu historial de servicios se conserva.", { danger: true, confirmText: "Quitar", cancelText: "Conservar" }))) return;
    const res = await fetch(`/api/portal/vehicles/${asset.id}`, { method: "DELETE", credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) return swalError("No se pudo quitar", data.error);
    setAssets((prev) => (prev ?? []).filter((a) => a.id !== asset.id));
  };

  const active = orders.filter((o) => o.status === "open" || o.status === "ready");
  const past = orders.filter((o) => o.status === "delivered" || o.status === "cancelled");

  return (
    <div className="space-y-6 pb-6">
      <section aria-label="Servicios en curso" className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Wrench className="size-4" /> Mis servicios
        </h2>
        {assets === null ? (
          <Skeleton className="h-28 rounded-2xl" />
        ) : active.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">No tienes servicios en curso. Cuando dejes un vehículo, aquí verás en qué etapa va.</p>
        ) : (
          active.map((o) => (
            <article key={o.id} className={cn("space-y-3 rounded-2xl border bg-card p-4", o.status === "ready" && "border-success/60")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{o.asset ? `${o.asset.label}${o.asset.reference ? ` · ${o.asset.reference}` : ""}` : `Orden #${o.number}`}</p>
                  <p className="truncate text-xs text-muted-foreground">{o.services.join(" + ")}</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", o.status === "ready" ? "bg-success/15 text-success-ink" : "bg-primary/10 text-primary")}>{o.statusLabel}</span>
              </div>
              <ol className="flex items-center gap-1" aria-label="Avance del servicio">
                {o.steps.map((s) => (
                  <li key={s.label} className="min-w-0 flex-1" aria-current={s.state === "current" ? "step" : undefined}>
                    <span className={cn("block h-1.5 rounded-full", s.state === "done" ? "bg-success" : s.state === "current" ? "bg-primary" : "bg-muted")} />
                    <span className={cn("mt-1 block truncate text-[11px]", s.state === "current" ? "font-medium text-foreground" : "text-muted-foreground")}>{s.label}</span>
                  </li>
                ))}
              </ol>
              <p className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" /> {o.promisedAt ? `Lo prometen a las ${time(o.promisedAt)}` : `Recibido a las ${time(o.createdAt)}`}
                </span>
                <span className="tabular-nums">{money(o.total)} + impuestos</span>
              </p>
            </article>
          ))
        )}
      </section>

      <section aria-label="Mis vehículos" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Car className="size-4" /> Mis vehículos
          </h2>
          {!adding && (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> Agregar
            </Button>
          )}
        </div>
        {adding && (
          <div className="space-y-3 rounded-2xl border bg-card p-4">
            <InputGroupField label="Nombre" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ej. Tsuru gris" maxLength={120} />
            <div className="grid grid-cols-2 gap-3">
              <InputGroupField label="Placa" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="ABC-123" maxLength={40} />
              <InputGroupField label="Tamaño" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} placeholder="chico, mediano…" maxLength={40} helper="Sirve para el precio del servicio." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setAdding(false)}>
                Cancelar
              </Button>
              <Button onClick={() => void add()} disabled={saving || !(form.label.trim() || form.reference.trim())}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Guardar
              </Button>
            </div>
          </div>
        )}
        {assets === null ? (
          <Skeleton className="h-20 rounded-2xl" />
        ) : assets.length === 0 && !adding ? (
          <EmptyState icon={Car} title="Aún no tienes vehículos" description="Regístralos para que el negocio te reciba más rápido." action={<Button onClick={() => setAdding(true)}>Agregar vehículo</Button>} />
        ) : (
          <ul className="space-y-2">
            {assets.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted">
                  <Car className="size-5 text-muted-foreground" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{a.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[a.reference, a.size].filter(Boolean).join(" · ") || "Sin placa"}</span>
                </span>
                <Button variant="ghost" size="icon" aria-label={`Quitar ${a.label}`} onClick={() => void remove(a)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section aria-label="Servicios anteriores" className="space-y-2">
          <h2 className="text-base font-semibold">Anteriores</h2>
          <ul className="space-y-1.5">
            {past.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm">
                <span className="min-w-0 truncate">
                  {o.asset?.label ?? `Orden #${o.number}`} · {o.services.join(" + ")}
                </span>
                <span className={cn("shrink-0 text-xs", o.status === "cancelled" ? "text-destructive" : "text-muted-foreground")}>{o.statusLabel}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
