"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Car, Check, ClipboardList, KeyRound, Loader2, MapPin, Plus, UserRound } from "lucide-react";
import { toast } from "sonner";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormCombobox } from "@/components/base/form-combobox";
import { InputGroupField } from "@/components/base/input-group-field";
import { TextareaField } from "@/components/base/textarea-field";
import { DateTimePicker } from "@/components/base/date-time-picker";
import { matchesSearch } from "@/lib/search";
import { cn } from "@/lib/utils";
import { money, type CatalogService } from "./types";

interface CustomerRow {
  id: string;
  customerCode: string | null;
  fullName: string;
  phone: string | null;
}
interface AssetRow {
  id: string;
  label: string;
  reference: string | null;
  size: string | null;
}
interface Option {
  id: string;
  name: string;
}

/** Recibir un vehículo: cliente, su vehículo, servicios, lugar, llavero e indicaciones. */
export function ServiceOrderIntakeDialog({
  open,
  onOpenChange,
  canManageAssets,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManageAssets: boolean;
  onCreated: (order: { id: string; flow: { id: string } }) => void;
}) {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [savingCustomer, setSavingCustomer] = useState(false);

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [assetId, setAssetId] = useState("");
  const [creatingAsset, setCreatingAsset] = useState(false);
  const [newAsset, setNewAsset] = useState({ label: "", reference: "", size: "" });
  const [savingAsset, setSavingAsset] = useState(false);

  const [services, setServices] = useState<CatalogService[]>([]);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [serviceQ, setServiceQ] = useState("");
  const [stations, setStations] = useState<Option[]>([]);
  const [stationId, setStationId] = useState("");
  const [employees, setEmployees] = useState<{ id: string; fullName: string }[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [keyTag, setKeyTag] = useState("");
  const [promisedAt, setPromisedAt] = useState<Date | null>(null);
  const [indications, setIndications] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async (q: string) => {
    try {
      const res = await fetch(`/api/crud/customers?pageSize=100&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (res.ok && data.ok) setCustomers(data.rows ?? []);
    } catch {
      /* el diálogo muestra lo que alcanzó a cargar */
    }
  }, []);

  // La lista trae solo una parte de los clientes: al escribir se busca en el servidor (con una pausa breve).
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchCustomers = useCallback(
    (q: string) => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => void loadCustomers(q), 250);
    },
    [loadCustomers]
  );
  useEffect(() => () => { if (searchTimer.current) clearTimeout(searchTimer.current); }, []);

  // Reinicia el formulario una vez por apertura.
  const prevOpen = useRef(false);
  useEffect(() => {
    if (!open) {
      prevOpen.current = false;
      return;
    }
    if (prevOpen.current) return;
    prevOpen.current = true;
    setError(null);
    setSaving(false);
    setCustomerId("");
    setCreatingCustomer(false);
    setAssetId("");
    setAssets([]);
    setCreatingAsset(false);
    setPicked({});
    setServiceQ("");
    setStationId("");
    setEmployeeId("");
    setKeyTag("");
    setPromisedAt(null);
    setIndications("");
    void loadCustomers("");
    fetch("/api/service-orders/catalog", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setServices(d.services ?? []))
      .catch(() => setServices([]));
    fetch("/api/crud/stations?pageSize=100")
      .then((r) => r.json())
      .then((d) => setStations((d.rows ?? []).filter((s: { isActive?: boolean }) => s.isActive !== false)))
      .catch(() => setStations([]));
    fetch("/api/crud/employees?pageSize=100")
      .then((r) => r.json())
      .then((d) => setEmployees((d.rows ?? []).filter((e: { isActive?: boolean }) => e.isActive !== false)))
      .catch(() => setEmployees([]));
  }, [open, loadCustomers]);

  // Los vehículos son del cliente elegido.
  useEffect(() => {
    setAssetId("");
    setCreatingAsset(false);
    if (!customerId) {
      setAssets([]);
      return;
    }
    fetch(`/api/crud/assets?customerId=${encodeURIComponent(customerId)}&pageSize=50`)
      .then((r) => r.json())
      .then((d) => {
        const list = (d.rows ?? []).filter((a: { isActive?: boolean }) => a.isActive !== false);
        setAssets(list);
        // Un solo vehículo registrado: se elige solo.
        if (list.length === 1) setAssetId(list[0].id);
      })
      .catch(() => setAssets([]));
  }, [customerId]);

  const asset = assets.find((a) => a.id === assetId);
  // El tamaño del vehículo sugiere la variante de precio (chico, mediano, camioneta…).
  const suggested = useMemo(() => new Set(asset?.size ? services.filter((s) => s.variantName && matchesSearch(s.variantName, asset.size!)).map((s) => s.variantId) : []), [asset, services]);
  const visibleServices = useMemo(
    () =>
      services
        .filter((s) => !serviceQ.trim() || matchesSearch(`${s.name} ${s.variantName ?? ""}`, serviceQ))
        .sort((a, b) => Number(suggested.has(b.variantId)) - Number(suggested.has(a.variantId))),
    [services, serviceQ, suggested]
  );
  const total = services.reduce((sum, s) => sum + (picked[s.variantId] ? s.price * picked[s.variantId] : 0), 0);
  const pickedCount = Object.keys(picked).length;

  const toggle = (variantId: string) =>
    setPicked((prev) => {
      const next = { ...prev };
      if (next[variantId]) delete next[variantId];
      else next[variantId] = 1;
      return next;
    });

  const createCustomer = async () => {
    setSavingCustomer(true);
    setError(null);
    try {
      const res = await fetch("/api/crud/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: newName, phone: newPhone || null }) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo crear el cliente");
      setCustomers((prev) => [data.row, ...prev.filter((c) => c.id !== data.row.id)]);
      setCustomerId(data.row.id);
      setCreatingCustomer(false);
      setNewName("");
      setNewPhone("");
      toast.success("Cliente creado");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el cliente");
    } finally {
      setSavingCustomer(false);
    }
  };

  const createAsset = async () => {
    setSavingAsset(true);
    setError(null);
    try {
      const res = await fetch("/api/crud/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, kind: "vehicle", label: newAsset.label, reference: newAsset.reference, size: newAsset.size }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo guardar el vehículo");
      setAssets((prev) => [data.row, ...prev]);
      setAssetId(data.row.id);
      setCreatingAsset(false);
      setNewAsset({ label: "", reference: "", size: "" });
      toast.success("Vehículo guardado en el cliente");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el vehículo");
    } finally {
      setSavingAsset(false);
    }
  };

  const submit = async () => {
    setError(null);
    if (!pickedCount) return setError("Elige al menos un servicio");
    setSaving(true);
    try {
      const res = await fetch("/api/service-orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId || null,
          assetId: assetId || null,
          stationId: stationId || null,
          employeeId: employeeId || null,
          keyTag: keyTag || null,
          indications: indications || null,
          promisedAt: promisedAt ? promisedAt.toISOString() : null,
          items: Object.entries(picked).map(([variantId, quantity]) => ({ variantId, quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo crear la orden");
      toast.success(`Orden #${data.order.number} creada`);
      onCreated(data.order);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la orden");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogComponent
      open={open}
      onOpenChange={onOpenChange}
      icon={<ClipboardList className="size-5 text-primary" />}
      title="Recibir vehículo"
      description="Cliente, vehículo y servicios. El precio sale del catálogo."
      className="sm:max-w-2xl"
      footer={
        <>
          {error && <p className="mr-auto text-sm font-medium text-destructive">{error}</p>}
          <span className="mr-auto hidden text-sm text-muted-foreground sm:inline">{pickedCount ? `${pickedCount} servicio${pickedCount === 1 ? "" : "s"} · ${money(total)}` : ""}</span>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Crear orden
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormCombobox
            label="Cliente"
            value={customerId}
            onChange={setCustomerId}
            onClear={() => setCustomerId("")}
            onSearchChange={searchCustomers}
            onCreate={() => setCreatingCustomer((v) => !v)}
            options={customers.map((c) => ({ value: c.id, label: c.fullName, meta: c.phone ?? c.customerCode ?? undefined }))}
            placeholder="Buscar por nombre o teléfono (vacío = cliente de mostrador)"
            searchPlaceholder="Nombre, teléfono o nº de cliente…"
            icon={<UserRound className="size-4" />}
            onSync={async () => {
              await loadCustomers("");
            }}
          />
          {creatingCustomer && (
            <div className="mt-2 flex flex-wrap items-end gap-2 rounded-xl border bg-muted/40 p-2.5">
              <div className="min-w-40 flex-1">
                <InputGroupField label="Nombre completo" required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ana Torres" />
              </div>
              <div className="w-36">
                <InputGroupField label="Teléfono" type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="55…" />
              </div>
              <Button size="sm" onClick={() => void createCustomer()} disabled={savingCustomer || !newName.trim()}>
                {savingCustomer ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Crear
              </Button>
            </div>
          )}
        </div>

        {customerId && (
          <div className="sm:col-span-2">
            <FormCombobox
              label="Vehículo"
              value={assetId}
              onChange={setAssetId}
              onClear={() => setAssetId("")}
              onCreate={canManageAssets ? () => setCreatingAsset((v) => !v) : undefined}
              options={assets.map((a) => ({ value: a.id, label: a.label, meta: [a.reference, a.size].filter(Boolean).join(" · ") || undefined }))}
              placeholder={assets.length ? "Elige uno de sus vehículos" : "Este cliente aún no tiene vehículos registrados"}
              icon={<Car className="size-4" />}
            />
            {creatingAsset && (
              <div className="mt-2 grid gap-2 rounded-xl border bg-muted/40 p-2.5 sm:grid-cols-3">
                <InputGroupField label="Nombre" value={newAsset.label} onChange={(e) => setNewAsset({ ...newAsset, label: e.target.value })} placeholder="Tsuru gris" />
                <InputGroupField label="Placa" value={newAsset.reference} onChange={(e) => setNewAsset({ ...newAsset, reference: e.target.value })} placeholder="ABC-123" />
                <InputGroupField label="Tamaño" value={newAsset.size} onChange={(e) => setNewAsset({ ...newAsset, size: e.target.value })} placeholder="chico, mediano…" />
                <div className="sm:col-span-3">
                  <Button size="sm" onClick={() => void createAsset()} disabled={savingAsset || !(newAsset.label.trim() || newAsset.reference.trim())}>
                    {savingAsset ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Guardar vehículo
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2 sm:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="text-sm font-medium">
              Servicios <span className="font-normal text-muted-foreground">(elige al menos uno)</span>
            </p>
            {services.length > 8 && <InputGroupField label="Buscar servicio" type="search" value={serviceQ} onChange={(e) => setServiceQ(e.target.value)} containerClassName="w-56" />}
          </div>
          {services.length === 0 ? (
            <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">No hay servicios. Crea productos sin control de inventario (servicios) en Productos.</p>
          ) : (
            <ul className="grid max-h-56 gap-1.5 overflow-y-auto sm:grid-cols-2">
              {visibleServices.map((s) => {
                const on = Boolean(picked[s.variantId]);
                return (
                  <li key={s.variantId}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(s.variantId)}
                      className={cn("press flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm", on ? "border-primary bg-primary/10" : "hover:bg-muted/50")}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{s.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {s.variantName ?? "Precio único"}
                          {suggested.has(s.variantId) ? " · sugerido por el tamaño" : ""}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums">{money(s.price)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {stations.length > 0 && (
          <FormCombobox label="Lugar de atención" value={stationId} onChange={setStationId} onClear={() => setStationId("")} options={stations.map((s) => ({ value: s.id, label: s.name }))} placeholder="Bahía, silla… (opcional)" icon={<MapPin className="size-4" />} />
        )}
        {employees.length > 0 && (
          <FormCombobox label="Responsable" value={employeeId} onChange={setEmployeeId} onClear={() => setEmployeeId("")} options={employees.map((e) => ({ value: e.id, label: e.fullName }))} placeholder="Quién lo atiende (opcional)" icon={<UserRound className="size-4" />} />
        )}
        <InputGroupField label="Llavero o gancho" value={keyTag} onChange={(e) => setKeyTag(e.target.value)} placeholder="Ej. A-12" leftIcon={<KeyRound className="size-4" />} helper="Número del llavero donde cuelgas las llaves; no se puede repetir mientras la orden siga abierta." maxLength={20} />
        <DateTimePicker label="Hora prometida" value={promisedAt} onChange={setPromisedAt} helper="Opcional: avisa en el tablero si se pasa." />
        <div className="sm:col-span-2">
          <TextareaField label="Indicaciones" value={indications} onChange={(e) => setIndications(e.target.value)} placeholder="Ej. rayón en la puerta derecha, no usar cera en el tablero" rows={2} />
        </div>
      </div>
    </DialogComponent>
  );
}
