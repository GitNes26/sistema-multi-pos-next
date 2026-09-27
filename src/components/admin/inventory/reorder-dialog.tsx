"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, Loader2, PackagePlus, ShoppingCart, Store, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogComponent } from "@/components/ui/dialog";
import { FormCombobox } from "@/components/base/form-combobox";
import { inventoryApi, type ReorderGroup } from "@/lib/api";
import { swalError, swalToast } from "@/lib/swal";
import { money as formatCurrency } from "@/lib/pos/money";
import { cn } from "@/lib/utils";

// Pedido sugerido: lo que está en su mínimo, agrupado por proveedor.
// Al aceptar se crea una orden de compra (borrador) por proveedor, con su
// costo, pedido mínimo y fecha estimada según los días de entrega.

type LineState = { include: boolean; quantity: string; unitCost: string; supplierId: string };

export function ReorderDialog({
  open,
  onOpenChange,
  locationType,
  locationId,
  locationName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationType: string;
  locationId: string;
  locationName: string;
}) {
  const [groups, setGroups] = useState<ReorderGroup[]>([]);
  const [lines, setLines] = useState<Record<string, LineState>>({});
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ id: string; folio: string }[] | null>(null);

  useEffect(() => {
    if (!open || !locationId) return;
    setCreated(null);
    setLoading(true);
    Promise.all([
      inventoryApi.reorderSuggestions({ locationType, locationId }),
      fetch("/api/purchasing").then((r) => r.json()).catch(() => null) as Promise<{ data?: { suppliers?: { id: string; businessName: string; isActive: boolean }[] } } | null>,
    ])
      .then(([res, ws]) => {
        setGroups(res.groups);
        setLines(
          Object.fromEntries(
            res.groups.flatMap((g) =>
              g.lines.map((l) => [l.inventoryId, { include: !!g.supplierId, quantity: String(l.suggested), unitCost: String(l.unitCost), supplierId: g.supplierId ?? "" }])
            )
          )
        );
        setSuppliers((ws?.data?.suppliers ?? []).filter((s) => s.isActive).map((s) => ({ id: s.id, name: s.businessName })));
      })
      .catch((error) => swalError("No se pudieron calcular las sugerencias", error instanceof Error ? error.message : undefined))
      .finally(() => setLoading(false));
  }, [open, locationType, locationId]);

  const patch = (id: string, value: Partial<LineState>) => setLines((cur) => ({ ...cur, [id]: { ...cur[id], ...value } }));

  // Órdenes finales agrupadas por el proveedor de cada línea (el sugerido o el elegido).
  const orders = useMemo(() => {
    const map = new Map<string, { supplierId: string; lines: { productId: string; variantId: string | null; quantity: number; unitCost: number; description: string; link: boolean }[]; total: number }>();
    for (const g of groups) {
      for (const l of g.lines) {
        const s = lines[l.inventoryId];
        const qty = Number(s?.quantity);
        if (!s?.include || !s.supplierId || !(qty > 0)) continue;
        const cost = Number(s.unitCost) || 0;
        const o = map.get(s.supplierId) ?? { supplierId: s.supplierId, lines: [], total: 0 };
        o.lines.push({ productId: l.productId, variantId: l.variantId, quantity: qty, unitCost: cost, description: l.name, link: !g.supplierId });
        o.total += qty * cost;
        map.set(s.supplierId, o);
      }
    }
    return [...map.values()];
  }, [groups, lines]);
  const grandTotal = orders.reduce((s, o) => s + o.total, 0);

  const create = async () => {
    setCreating(true);
    try {
      const res = await inventoryApi.createReorderOrders({ locationType, locationId, orders: orders.map(({ supplierId, lines }) => ({ supplierId, lines })) });
      setCreated(res.orders);
      swalToast(res.orders.length === 1 ? "Orden de compra creada" : `${res.orders.length} órdenes de compra creadas`);
    } catch (error) {
      swalError("No se pudieron crear las órdenes", error instanceof Error ? error.message : undefined);
    } finally {
      setCreating(false);
    }
  };

  const totalLines = groups.reduce((s, g) => s + g.lines.length, 0);

  return (
    <DialogComponent
      open={open}
      onOpenChange={onOpenChange}
      icon={<ShoppingCart className="size-5" />}
      title="Pedido sugerido"
      description={`Productos en su mínimo en ${locationName}. Ajusta cantidades y crea una orden por proveedor.`}
      size="4xl"
      bodyClassName="space-y-4"
      footer={
        created ? (
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
            <Button asChild>
              <Link href="/admin/purchasing">Ver órdenes de compra</Link>
            </Button>
          </>
        ) : (
          <>
            <span className="mr-auto text-sm text-muted-foreground">
              {orders.length} {orders.length === 1 ? "orden" : "órdenes"} · <b className="text-foreground tabular-nums">{formatCurrency(grandTotal)}</b>
            </span>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => void create()} disabled={!orders.length || creating}>
              {creating ? <Loader2 className="size-4 animate-spin" /> : <PackagePlus className="size-4" />}
              {orders.length > 1 ? `Crear ${orders.length} órdenes` : "Crear orden de compra"}
            </Button>
          </>
        )
      }
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Calculando lo que hace falta…
        </div>
      ) : created ? (
        <div className="rounded-2xl border border-success/30 bg-success/5 p-6 text-center">
          <PackagePlus className="mx-auto size-10 text-success" />
          <p className="mt-3 text-lg font-semibold">Órdenes listas en borrador</p>
          <p className="mt-1 text-sm text-muted-foreground">Revísalas, apruébalas y envíalas al proveedor desde Compras.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {created.map((o) => (
              <span key={o.id} className="rounded-full border bg-background px-3 py-1 font-mono text-sm">{o.folio}</span>
            ))}
          </div>
        </div>
      ) : !totalLines ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Todo está por encima de su mínimo. Define mínimos en la captura rápida para recibir sugerencias.
        </div>
      ) : (
        groups.map((g) => {
          const unassigned = !g.supplierId;
          return (
            <section key={g.supplierId ?? "none"} className={cn("overflow-hidden rounded-2xl border", unassigned && "border-warning/40")}>
              <header className={cn("flex flex-wrap items-center gap-3 px-4 py-3", unassigned ? "bg-warning/10" : "bg-muted/50")}>
                <span className={cn("grid size-9 place-items-center rounded-xl", unassigned ? "bg-warning/20 text-warning-ink" : "bg-primary/10 text-primary")}>
                  {unassigned ? <TriangleAlert className="size-4" /> : <Store className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{g.supplierName}</p>
                  <p className="text-xs text-muted-foreground">
                    {unassigned
                      ? "Elige un proveedor por producto; quedará guardado como su proveedor preferido."
                      : `${g.lines.length} productos${g.leadTimeDays ? ` · entrega en ~${g.leadTimeDays} días` : ""}`}
                  </p>
                </div>
                {!unassigned && g.leadTimeDays > 0 && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarClock className="size-3.5" />
                    Llega aprox. {new Date(Date.now() + g.leadTimeDays * 86400000).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                  </span>
                )}
              </header>
              <div className="divide-y">
                {g.lines.map((l) => {
                  const s = lines[l.inventoryId];
                  if (!s) return null;
                  return (
                    <div key={l.inventoryId} className={cn("grid items-center gap-3 px-4 py-2.5 sm:grid-cols-[auto_1fr_auto]", !s.include && "opacity-60")}>
                      <Checkbox checked={s.include} onCheckedChange={(v) => patch(l.inventoryId, { include: v === true })} aria-label={`Incluir ${l.name}`} disabled={unassigned && !s.supplierId} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{l.name}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          Hay <b className={cn(l.current <= 0 ? "text-destructive" : "text-warning-ink")}>{l.current}</b> {l.unit ?? "pza"} · mínimo {l.min}
                          {l.minimumOrder > 1 ? ` · pedido mínimo ${l.minimumOrder}` : ""}
                          {l.supplierSku ? ` · clave prov. ${l.supplierSku}` : ""}
                        </p>
                        {unassigned && (
                          <FormCombobox
                            value={s.supplierId}
                            onChange={(v) => patch(l.inventoryId, { supplierId: v, include: !!v })}
                            options={suppliers.map((sp) => ({ value: sp.id, label: sp.name }))}
                            placeholder={suppliers.length ? "Elegir proveedor…" : "Registra proveedores en Compras"}
                            className="mt-1.5 w-full max-w-xs"
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground">
                          Pedir
                          <Input type="number" min="0" step="0.001" value={s.quantity} onChange={(e) => patch(l.inventoryId, { quantity: e.target.value })} className="mt-0.5 h-8 w-20 tabular-nums" />
                        </label>
                        <label className="text-xs text-muted-foreground">
                          Costo unit.
                          <Input type="number" min="0" step="0.01" value={s.unitCost} onChange={(e) => patch(l.inventoryId, { unitCost: e.target.value })} className="mt-0.5 h-8 w-24 tabular-nums" />
                        </label>
                        <span className="w-24 text-right text-sm font-semibold tabular-nums">{formatCurrency((Number(s.quantity) || 0) * (Number(s.unitCost) || 0))}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </DialogComponent>
  );
}
