"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardList, Clock, KeyRound, Loader2, MapPin, Plus, Settings2, Car, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentedFilter } from "@/components/base";
import { EmptyState } from "@/components/shared/empty-state";
import { useLiveStream } from "@/hooks/use-live-stream";
import { useVisibleInterval } from "@/hooks/use-visible-interval";
import { swalError } from "@/lib/swal";
import { cn } from "@/lib/utils";
import { elapsed, money, type Flow, type ServiceOrder } from "./types";
import { ServiceOrderIntakeDialog } from "./service-order-intake-dialog";
import { ServiceOrderDetailDialog } from "./service-order-detail-dialog";
import { ServiceFlowsDialog } from "./service-flows-dialog";

interface BoardProps {
  canManage: boolean;
  canConfigure: boolean;
  canManageAssets: boolean;
}

/** Tablero por etapas: cada columna es una etapa del flujo; la tarjeta avanza con un toque. */
export function ServiceOrdersBoard({ canManage, canConfigure, canManageAssets }: BoardProps) {
  const [orders, setOrders] = useState<ServiceOrder[] | null>(null);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [flowId, setFlowId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [flowsOpen, setFlowsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [stations, setStations] = useState<{ id: string; name: string }[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/service-orders", { cache: "no-store", credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo cargar el tablero");
      setOrders(data.orders);
      setFlows(data.flows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el tablero");
      setOrders((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
    // Bahías (si hay permiso para verlas): muestran qué espacio está libre y cuál ocupado.
    fetch("/api/crud/stations?pageSize=100")
      .then((r) => r.json())
      .then((d) => setStations((d.rows ?? []).filter((s: { isActive?: boolean }) => s.isActive !== false)))
      .catch(() => setStations([]));
  }, [load]);
  // Otras cajas o pantallas cambian órdenes: el tablero se actualiza solo; el sondeo es red de seguridad.
  useLiveStream("/api/service-orders/stream", () => void load());
  useVisibleInterval(() => {
    setNow(Date.now());
    void load();
  }, 60_000);

  // Flujo visible: el elegido o, por defecto, el primero con órdenes (o el predeterminado).
  const activeFlow = useMemo(() => flows.find((f) => f.id === flowId) ?? flows.find((f) => f.isDefault) ?? flows[0], [flows, flowId]);
  const flowOrders = useMemo(() => (orders ?? []).filter((o) => o.flow.id === activeFlow?.id), [orders, activeFlow]);
  const delivered = flowOrders.filter((o) => o.status === "delivered");

  const columns = useMemo(() => {
    if (!activeFlow) return [];
    const known = new Set(activeFlow.stages.map((s) => s.id));
    const cols = activeFlow.stages.map((stage) => ({ id: stage.id, label: stage.label, isReady: stage.isReady, orders: flowOrders.filter((o) => o.status !== "delivered" && o.stage.id === stage.id) }));
    // Órdenes en una etapa que se quitó del flujo: no se pierden de vista.
    const orphans = flowOrders.filter((o) => o.status !== "delivered" && !known.has(o.stage.id));
    return orphans.length ? [...cols, { id: "other", label: "Otras etapas", isReady: false, orders: orphans }] : cols;
  }, [activeFlow, flowOrders]);

  const move = async (order: ServiceOrder, stageId: string) => {
    setMovingId(order.id);
    try {
      const res = await fetch(`/api/service-orders/${order.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stageId }) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo mover la orden");
      await load();
    } catch (err) {
      swalError("No se pudo mover", err instanceof Error ? err.message : undefined);
      await load();
    } finally {
      setMovingId(null);
    }
  };

  const nextStage = (order: ServiceOrder) => {
    const stages = activeFlow?.stages ?? [];
    const at = stages.findIndex((s) => s.id === order.stage.id);
    return at >= 0 ? stages[at + 1] : undefined;
  };

  const selected = orders?.find((o) => o.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {flows.length > 1 && (
          <SegmentedFilter
            ariaLabel="Flujo"
            value={activeFlow?.id ?? ""}
            onChange={setFlowId}
            options={flows.map((f) => ({ value: f.id, label: f.name, count: (orders ?? []).filter((o) => o.flow.id === f.id && o.status !== "delivered").length }))}
          />
        )}
        <div className="ml-auto flex items-center gap-2">
          {canConfigure && (
            <Button variant="outline" size="sm" onClick={() => setFlowsOpen(true)}>
              <Settings2 className="size-4" /> Flujos y etapas
            </Button>
          )}
          {canManage && (
            <Button size="sm" onClick={() => setIntakeOpen(true)}>
              <Plus className="size-4" /> Recibir vehículo
            </Button>
          )}
        </div>
      </div>

      {stations.length > 0 && (
        <section aria-label="Bahías" className="flex flex-wrap gap-2">
          {stations.map((st) => {
            const occupant = (orders ?? []).find((o) => o.status === "open" && o.station?.id === st.id);
            return (
              <button
                key={st.id}
                type="button"
                disabled={!occupant}
                onClick={() => occupant && setSelectedId(occupant.id)}
                className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs", occupant ? "border-warning/50 bg-warning/10" : "border-success/40 bg-success/5 text-muted-foreground")}
              >
                <MapPin className="size-3.5" />
                <span className="font-medium">{st.name}</span>
                <span>{occupant ? `#${occupant.number} · ${occupant.asset?.label ?? "vehículo"}` : "Libre"}</span>
              </button>
            );
          })}
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {orders === null ? (
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : !activeFlow ? (
        <EmptyState icon={ClipboardList} title="Aún no hay flujos" description="Crea un flujo para empezar a recibir órdenes." />
      ) : (
        <>
          <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
            {columns.map((col) => (
              <section key={col.id} aria-label={col.label} className="w-72 shrink-0 snap-start space-y-2">
                <header className={cn("flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold", col.isReady ? "bg-success/15 text-success-ink" : "bg-muted")}>
                  <span className="inline-flex items-center gap-1.5">
                    {col.isReady && <CheckCircle2 className="size-4" />}
                    {col.label}
                  </span>
                  <span className="rounded-full bg-background/70 px-2 text-xs tabular-nums">{col.orders.length}</span>
                </header>
                <div className="space-y-2">
                  {col.orders.length === 0 && <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">Sin órdenes</p>}
                  {col.orders.map((o) => {
                    const next = nextStage(o);
                    const late = o.promisedAt && new Date(o.promisedAt).getTime() < now && o.status !== "ready";
                    return (
                      <article key={o.id} className={cn("press rounded-2xl border bg-card p-3 text-sm", o.status === "ready" && "border-success/50", late && "border-destructive/50")}>
                        <button type="button" className="block w-full text-left" onClick={() => setSelectedId(o.id)}>
                          <span className="flex items-start justify-between gap-2">
                            <span className="font-semibold">#{o.number}</span>
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="size-3" /> {elapsed(o.createdAt, now)}
                            </span>
                          </span>
                          <span className="mt-1 flex items-center gap-1.5">
                            <Car className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{o.asset ? `${o.asset.label}${o.asset.reference ? ` · ${o.asset.reference}` : ""}` : "Sin vehículo"}</span>
                          </span>
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <UserRound className="size-3.5 shrink-0" />
                            <span className="truncate">{o.customer?.fullName ?? "Cliente de mostrador"}</span>
                          </span>
                          <span className="mt-1 block truncate text-xs">{o.items.map((i) => (i.quantity > 1 ? `${i.quantity}× ` : "") + i.productName).join(" + ")}</span>
                          <span className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                            {o.station && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                                <MapPin className="size-3" /> {o.station.name}
                              </span>
                            )}
                            {o.keyTag && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                                <KeyRound className="size-3" /> {o.keyTag}
                              </span>
                            )}
                            {late && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">Pasó la hora prometida</span>}
                            <span className="ml-auto font-medium tabular-nums">{money(o.total)}</span>
                          </span>
                        </button>
                        {canManage && next && (
                          <Button size="sm" variant={next.isReady ? "default" : "outline"} className="mt-2 w-full" disabled={movingId === o.id} onClick={() => void move(o, next.id)}>
                            {movingId === o.id ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                            {next.isReady ? `Marcar «${next.label}»` : `Pasar a ${next.label}`}
                          </Button>
                        )}
                        {canManage && o.status === "ready" && (
                          <Button size="sm" className="mt-2 w-full" onClick={() => setSelectedId(o.id)}>
                            Cobrar y entregar
                          </Button>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {delivered.length > 0 && (
            <details className="rounded-2xl border p-3 text-sm">
              <summary className="cursor-pointer font-medium">Entregadas hoy ({delivered.length})</summary>
              <ul className="mt-2 space-y-1">
                {delivered.map((o) => (
                  <li key={o.id}>
                    <button type="button" className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted/50" onClick={() => setSelectedId(o.id)}>
                      <span className="truncate">
                        #{o.number} · {o.asset?.label ?? "Sin vehículo"} · {o.customer?.fullName ?? "Mostrador"}
                      </span>
                      <span className="tabular-nums">{money(o.total)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {flowOrders.length === 0 && (
            <EmptyState
              icon={ClipboardList}
              title="Sin órdenes por ahora"
              description={canManage ? "Cuando llegue un vehículo, usa «Recibir vehículo»." : "Aquí aparecerán las órdenes del día."}
              action={canManage ? <Button onClick={() => setIntakeOpen(true)}>Recibir vehículo</Button> : undefined}
            />
          )}
        </>
      )}

      <ServiceOrderIntakeDialog open={intakeOpen} onOpenChange={setIntakeOpen} canManageAssets={canManageAssets} onCreated={() => void load()} />
      <ServiceOrderDetailDialog
        order={selected}
        flow={flows.find((f) => f.id === selected?.flow.id) ?? null}
        canManage={canManage}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onChanged={() => void load()}
      />
      {canConfigure && <ServiceFlowsDialog open={flowsOpen} onOpenChange={setFlowsOpen} onSaved={() => void load()} />}
    </div>
  );
}
