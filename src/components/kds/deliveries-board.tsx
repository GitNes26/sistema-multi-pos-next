"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bike,
  CircleCheckBig,
  Loader2,
  LocateFixed,
  MapPin,
  PackageCheck,
  RefreshCw,
  Truck,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Spinner } from "@/components/base/spinner";
import { DeliveryConfirmDialog } from "@/components/admin/orders/delivery-confirm-dialog";
import { money } from "@/lib/pos/money";
import { ordersApi } from "@/lib/orders/client";
import { playSound } from "@/lib/sounds";
import { swalError, swalNotificationToast, swalToast } from "@/lib/swal";
import { useSseStore } from "@/stores/sse-store";
import { useStaleData } from "@/hooks/use-stale-data";
import { StaleBanner } from "@/components/shared/stale-banner";
import { cn } from "@/lib/utils";

// Sección "Entregas" del KDS (/kds): la cola de trabajo del repartidor.
// Mostrada solo con delivery.manage (la página resuelve el permiso en
// servidor). El flujo de cada pedido a domicilio:
//   ready → Iniciar entrega (delivery.manage) → in_transit
//   in_transit → Confirmar llegada (delivery.manage) → at_destination (PIN+QR)
//   at_destination → Confirmar entrega con PIN/QR (delivery.manage) → delivered
// Los pedidos "listos para recoger" del mostrador se muestran aparte (pickup),
// porque el cliente los retira en caja: ahí el pickup hace de cola de entrega.

interface DeliveryRow {
  id: string;
  orderNumber: number;
  status: string;
  deliveryMethod: string;
  customerName: string | null;
  address: string | null;
  total: number;
  createdAt: string;
}

const STALE_MIN = 5;

/** Id de la suscripción SSE de este tablero dentro del store compartido. */
const SSE_ID = "deliveries";

/** Mínimo entre POSTs de ubicación al servidor (por movimiento, no por reloj). */
const GPS_MIN_INTERVAL_MS = 15_000;

function minutesAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function Elapsed({ iso }: { iso: string }) {
  // Re-render cada 30 s para mantener fresco el contador sin un estado global.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const mins = minutesAgo(iso);
  return (
    <span className={cn("text-[10px] text-muted-foreground", mins >= STALE_MIN && "font-semibold text-amber-600 dark:text-amber-400")}>
      {mins < 1 ? "ahora" : `hace ${mins} min`}
    </span>
  );
}

export function DeliveriesBoard() {
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; orderNumber: number; mode: "delivery" | "pickup" } | null>(null);

  // Estado SSE reportado al badge "En vivo" del encabezado de la página.
  const registerSse = useSseStore((s) => s.register);
  const unregisterSse = useSseStore((s) => s.unregister);
  const setSseStatus = useSseStore((s) => s.setStatus);

  // Aviso de datos desactualizados si el stream de este tablero se cae y el
  // último refresco exitoso ya lleva más de un minuto.
  const deliveriesLive = useSseStore((s) => s.sources["deliveries"]?.connected ?? false);
  const { stale: dataStale, markFresh } = useStaleData(deliveriesLive);

  // ── GPS del repartidor (pedidos en camino) ────────────────────────────
  // Un solo watchPosition alimenta todos los pedidos in_transit: la posición
  // es del repartidor, no del pedido. Se pide permiso solo cuando hay
  // repartos activos y se detiene al quedar la cola vacía.
  const [gpsState, setGpsState] = useState<"idle" | "active" | "denied" | "unsupported">("idle");
  const [gpsLastAt, setGpsLastAt] = useState<number | null>(null);
  const watchRef = useRef<number | null>(null);
  const lastPostRef = useRef(0);
  const inTransitIdsRef = useRef<string[]>([]);

  // Alertas de pedidos listos (la cola ya no hace polling: el SSE dispara el
  // refresco y el diff contra la instantánea anterior detecta los nuevos).
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(true);
  const prevReadyIdsRef = useRef<Set<string> | null>(null);

  const toggleSound = () => {
    setSoundEnabled((v) => {
      soundEnabledRef.current = !v;
      return !v;
    });
  };

  /** Detecta pedidos que pasaron a ready desde la última carga: sonido + toast. */
  const alertNewReady = (rows: DeliveryRow[]) => {
    const ready = rows.filter((r) => r.status === "ready");
    const prev = prevReadyIdsRef.current;
    prevReadyIdsRef.current = new Set(ready.map((r) => r.id));
    if (!prev) return; // primera carga: sembrar, no alertar por la cola existente
    const fresh = ready.filter((r) => !prev.has(r.id));
    if (fresh.length === 0) return;
    if (soundEnabledRef.current) playSound("order-ready", { volume: 0.7 });
    if (fresh.length === 1) {
      const r = fresh[0];
      swalNotificationToast({
        title:
          r.deliveryMethod === "pickup"
            ? `Pedido #${r.orderNumber} listo para recoger`
            : `Pedido #${r.orderNumber} listo para entrega`,
        description: `${r.customerName ?? "Cliente"} · ${money(r.total)}`,
      });
    } else {
      swalNotificationToast({
        title: `${fresh.length} pedidos listos`,
        description: fresh.map((r) => `#${r.orderNumber}`).join(", "),
      });
    }
  };

  const inTransitKey = rows
    .filter((r) => r.deliveryMethod === "delivery" && r.status === "in_transit")
    .map((r) => r.id)
    .sort()
    .join(",");

  // IDs vigentes para el callback del watcher (sin closures viejas).
  useEffect(() => {
    inTransitIdsRef.current = inTransitKey ? inTransitKey.split(",") : [];
  }, [inTransitKey]);

  const postDriverLocation = useCallback(async (lat: number, lng: number) => {
    const ids = inTransitIdsRef.current;
    if (ids.length === 0) return;
    const now = Date.now();
    if (now - lastPostRef.current < GPS_MIN_INTERVAL_MS) return;
    lastPostRef.current = now;
    setGpsLastAt(now);
    // Fire-and-forget: el tracking es best-effort, nunca bloquea la entrega.
    for (const orderId of ids) {
      fetch(`/api/portal/orders/${orderId}/driver-location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    // Sin repartos en camino: detener el watcher y liberar el permiso activo.
    if (!inTransitKey) {
      if (watchRef.current != null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
      watchRef.current = null;
      setGpsState("idle");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGpsState("unsupported");
      return;
    }
    if (watchRef.current != null) return; // ya activo para otros pedidos

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsState("active");
        void postDriverLocation(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsState("denied");
          // Sin permiso no tiene sentido seguir intentando.
          if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
          watchRef.current = null;
        }
        // POSITION_UNAVAILABLE / TIMEOUT: watchPosition sigue intentando.
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 10_000 }
    );

    return () => {
      if (watchRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
      watchRef.current = null;
    };
  }, [inTransitKey, postDriverLocation]);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      // La cola activa incluye ready / in_transit / at_destination / delivered;
      // el tablero filtra lo relevante para el repartidor (delivered solo sirve
      // para el conteo del día, no se lista).
      const res = await fetch("/api/orders?active=1&pageSize=100", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) {
        setRows(data.rows ?? []);
        alertNewReady(data.rows ?? []);
        markFresh();
      }
    } catch {
      /* noop: conserva lo último */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [markFresh]);

  useEffect(() => {
    void load();
    if (typeof window === "undefined") return;

    // Suscripción SSE al canal KDS (el mismo de la cocina): cualquier cambio de
    // orden dispara un refresco con debounce — actualización instantánea, sin
    // polling de 30 s. El snapshot inicial se ignora porque `load()` ya corrió;
    // los siguientes (reconexión) sí refrescan por si hubo cambios offline.
    let es: EventSource | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    let firstSnapshot = true;

    registerSse(SSE_ID);
    const scheduleReload = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => void load(), 250);
    };

    es = new EventSource("/api/kds/stream");
    es.onopen = () => setSseStatus(SSE_ID, "connected");
    es.onmessage = () => {
      if (firstSnapshot) {
        firstSnapshot = false;
        return;
      }
      scheduleReload();
    };
    es.onerror = () => {
      // EventSource reconecta solo; el badge del encabezado muestra el corte.
      setSseStatus(SSE_ID, "reconnecting");
    };

    // Red de seguridad (reconexiones silenciosas / eventos perdidos). A 45 s:
    // mientras funcione, mantiene los datos por debajo del umbral de 60 s del
    // aviso de desactualización, que así solo aparece si el refresco falla.
    const fallback = setInterval(() => void load(), 45_000);

    return () => {
      es?.close();
      if (debounce) clearTimeout(debounce);
      clearInterval(fallback);
      unregisterSse(SSE_ID);
    };
  }, [load]);

  const startDelivery = async (row: DeliveryRow) => {
    setActingId(row.id);
    try {
      const res = await ordersApi.startDelivery(row.id);
      if (!res.ok) throw new Error("No se pudo iniciar la entrega");
      swalToast(`Pedido #${row.orderNumber} en camino`);
      await load();
    } catch (err) {
      swalError("No se pudo iniciar la entrega", err instanceof Error ? err.message : undefined);
    } finally {
      setActingId(null);
    }
  };

  const confirmArrival = async (row: DeliveryRow) => {
    setActingId(row.id);
    try {
      const res = await ordersApi.confirmArrival(row.id);
      if (!res.ok) throw new Error("No se pudo confirmar la llegada");
      swalToast(`Pedido #${row.orderNumber} en domicilio — pide el PIN o escanea el QR`);
      await load();
    } catch (err) {
      swalError("No se pudo confirmar la llegada", err instanceof Error ? err.message : undefined);
    } finally {
      setActingId(null);
    }
  };

  const queue = rows.filter((r) => r.deliveryMethod === "delivery");
  const toPickup = queue.filter((r) => r.status === "ready");
  const inTransit = queue.filter((r) => r.status === "in_transit");
  const atDoor = queue.filter((r) => r.status === "at_destination");
  // Mostrador (pickup): listos para retirar; la entrega se confirma con PIN/QR.
  const pickup = rows.filter((r) => r.deliveryMethod === "pickup" && r.status === "ready");

  const renderCard = (row: DeliveryRow, kind: "delivery" | "pickup") => {
    const busy = actingId === row.id;
    const stale = minutesAgo(row.createdAt) >= STALE_MIN;
    return (
      <div
        key={row.id}
        className={cn(
          "rounded-xl border bg-card px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md",
          stale ? "border-amber-400/70" : "border-border"
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tabular-nums">#{row.orderNumber}</span>
          <Badge
            variant="outline"
            className={cn(
              "text-[0.65rem]",
              kind === "delivery"
                ? "border-violet-300 bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300"
                : "border-sky-300 bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300"
            )}
          >
            {kind === "delivery" ? "A domicilio" : "Mostrador"}
          </Badge>
          <Elapsed iso={row.createdAt} />
          <span className="ml-auto text-sm font-bold tabular-nums">{money(row.total)}</span>
        </div>

        <div className="mt-1 flex items-center gap-1.5 text-xs">
          <span className="truncate font-medium">{row.customerName ?? "Cliente"}</span>
        </div>
        {row.address && (
          <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            <span className="line-clamp-2">{row.address}</span>
          </div>
        )}

        <div className="mt-2 flex gap-1.5">
          {kind === "delivery" && row.status === "ready" && (
            <Button size="sm" className="h-8 flex-1" disabled={busy} onClick={() => startDelivery(row)}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Bike className="size-3.5" />}
              Salir en camino
            </Button>
          )}
          {kind === "delivery" && row.status === "in_transit" && (
            <Button size="sm" className="h-8 flex-1" disabled={busy} onClick={() => confirmArrival(row)}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <MapPin className="size-3.5" />}
              Ya llegué
            </Button>
          )}
          {row.status === "at_destination" && (
            <Button
              size="sm"
              className="h-8 flex-1 bg-blue-600 hover:bg-blue-700"
              onClick={() => setConfirmTarget({ id: row.id, orderNumber: row.orderNumber, mode: kind })}
            >
              <CircleCheckBig className="size-3.5" />
              Confirmar entrega
            </Button>
          )}
          {kind === "pickup" && row.status === "ready" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 flex-1"
              onClick={() => setConfirmTarget({ id: row.id, orderNumber: row.orderNumber, mode: kind })}
            >
              <PackageCheck className="size-3.5" />
              Entregar (PIN/QR)
            </Button>
          )}
        </div>
      </div>
    );
  };

  const Column = ({
    title,
    icon,
    rows: colRows,
    kind,
    empty,
  }: {
    title: string;
    icon: React.ReactNode;
    rows: DeliveryRow[];
    kind: "delivery" | "pickup";
    empty: string;
  }) => (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {title}
        <Badge variant="outline" className="ml-1 text-[0.65rem]">
          {colRows.length}
        </Badge>
      </h3>
      {colRows.length === 0 ? (
        <p className="rounded-xl border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-2">{colRows.map((r) => renderCard(r, kind))}</div>
      )}
    </section>
  );

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // Indicador de GPS en el encabezado: solo visible con repartos en curso.
  const gpsChip = (() => {
    if (inTransit.length === 0) return null;
    if (gpsState === "denied")
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
          <LocateFixed className="size-3.5" /> GPS sin permiso
        </span>
      );
    if (gpsState === "unsupported")
      return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <LocateFixed className="size-3.5" /> GPS no disponible
        </span>
      );
    if (gpsState === "active") {
      const secs = gpsLastAt ? Math.floor((Date.now() - gpsLastAt) / 1000) : null;
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <LocateFixed className="size-3.5 animate-pulse" />
          GPS en vivo{secs != null ? ` · hace ${secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m`}` : ""}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <LocateFixed className="size-3.5" /> GPS iniciando…
      </span>
    );
  })();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-2xl font-bold">
          <Truck className="size-7" />
          Entregas
        </h2>
        <div className="flex items-center gap-2">
          {gpsChip}
          <span className="text-xs text-muted-foreground">
            {toPickup.length + inTransit.length + atDoor.length + pickup.length} activa(s)
          </span>
          <Button
            size="sm"
            variant={soundEnabled ? "default" : "outline"}
            onClick={toggleSound}
            title={soundEnabled ? "Silenciar alertas" : "Activar alertas sonoras"}
          >
            {soundEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </Button>
          <Button size="sm" variant="outline" onClick={() => load(true)} disabled={refreshing}>
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} /> Refrescar
          </Button>
        </div>
      </div>

      <StaleBanner show={dataStale} />

      {toPickup.length + inTransit.length + atDoor.length + pickup.length === 0 ? (
        <EmptyState icon={Truck} title="Sin entregas activas" description="Los pedidos listos aparecerán aquí automáticamente." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Column title="Listos para salir" icon={<PackageCheck className="size-4" />} rows={toPickup} kind="delivery" empty="Sin pedidos listos para salir a domicilio." />
          <Column title="En camino" icon={<Bike className="size-4" />} rows={inTransit} kind="delivery" empty="Sin repartos en curso." />
          <Column title="En domicilio" icon={<MapPin className="size-4" />} rows={atDoor} kind="delivery" empty="Ningún reparto en puerta." />
          <Column title="Mostrador (recoger)" icon={<PackageCheck className="size-4" />} rows={pickup} kind="pickup" empty="Sin pedidos listos para retirar." />
        </div>
      )}

      {confirmTarget && (
        <DeliveryConfirmDialog
          open={!!confirmTarget}
          onOpenChange={(o) => !o && setConfirmTarget(null)}
          orderId={confirmTarget.id}
          orderNumber={confirmTarget.orderNumber}
          mode={confirmTarget.mode}
          onConfirmed={() => {
            setConfirmTarget(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
