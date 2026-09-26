"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  Armchair,
  Bell,
  BellRing,
  CalendarCheck2,
  Check,
  ChefHat,
  Clock,
  Flame,
  Loader2,
  MapPin,
  StickyNote,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RoleBadge } from "@/components/shared/role-badge";
import { useSseStore } from "@/stores/sse-store";
import { playSound } from "@/lib/sounds";
import { useStaleData } from "@/hooks/use-stale-data";
import { StaleBanner } from "@/components/shared/stale-banner";
import { Spinner } from "@/components/base/spinner";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface KDSOrder {
  id: string;
  orderNumber: string | number;
  status: string;
  createdAt: string;
  elapsedSeconds: number;
  table: {
    id: string;
    number: number;
    name: string | null;
    room: { id: string; name: string } | null;
  } | null;
  location: { id: string; name: string } | null;
  items: {
    id: string;
    productName: string;
    variantName: string | null;
    quantity: number | string;
    itemStatus: string;
    selectedOptions: { optionName: string; values: { value: string }[] }[] | null;
    comment: string | null;
  }[];
  preparation: { id: string; startedAt: string | null; generalNotes: string | null } | null;
}

interface KDSStats {
  pending: number;
  confirmed: number;
  preparing: number;
  totalItems: number;
  readyItems: number;
}

interface UpcomingReservation {
  id: string;
  guests: number;
  startsAt: string;
  table: {
    id: string;
    number: number;
    name: string | null;
    room: { id: string; name: string } | null;
  } | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getOrderUrgency(seconds: number): "critical" | "warning" | "normal" {
  if (seconds > 600) return "critical"; // >10 min
  if (seconds > 300) return "warning";  // >5 min
  return "normal";
}

/* ------------------------------------------------------------------ */
/*  OrderCard                                                          */
/* ------------------------------------------------------------------ */

function OrderCard({ order, onUpdate }: { order: KDSOrder; onUpdate: () => void }) {
  const [updating, setUpdating] = useState<string | null>(null);

  const urgency = getOrderUrgency(order.elapsedSeconds);
  const readyCount = order.items.filter((i) => i.itemStatus === "ready" || i.itemStatus === "served").length;
  const progress = order.items.length ? readyCount / order.items.length : 0;
  const URGENCY = {
    critical: { card: "border-destructive ring-2 ring-destructive/25", head: "bg-destructive/12", chip: "bg-destructive text-destructive-foreground", label: "Atrasada" },
    warning: { card: "border-warning", head: "bg-warning/15", chip: "bg-warning text-warning-foreground", label: "Atención" },
    normal: { card: "border-border", head: "bg-surface-sunken", chip: "bg-card text-foreground ring-1 ring-border", label: "A tiempo" },
  }[urgency];

  const handleItemStatus = async (itemId: string, newStatus: string) => {
    setUpdating(itemId);
    try {
      await fetch("/api/kds", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderItemId: itemId, status: newStatus }) });
      onUpdate();
    } catch {
      // silently fail
    } finally {
      setUpdating(null);
    }
  };

  const handleOrderAction = async (action: string) => {
    setUpdating("order");
    try {
      await fetch("/api/kds", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id, action }) });
      onUpdate();
    } catch {
      // silently fail
    } finally {
      setUpdating(null);
    }
  };

  return (
    <article
      aria-label={`Orden ${order.orderNumber}`}
      className={cn("flex flex-col overflow-hidden rounded-2xl border-2 bg-card shadow-e1 transition-[border-color,box-shadow] duration-300", URGENCY.card)}
    >
      {/* Encabezado: número y mesa legibles a distancia; tiempo con estado en texto */}
      <header className={cn("space-y-2 px-4 pt-3.5 pb-3", URGENCY.head)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-heading text-3xl leading-none font-bold tracking-tight tabular">#{order.orderNumber}</p>
            {order.table ? (
              <p className="mt-1.5 flex items-center gap-1.5 truncate text-base font-semibold">
                <Armchair className="size-4 shrink-0" />
                Mesa {order.table.number}
                {order.table.name && <span className="font-normal text-muted-foreground">· {order.table.name}</span>}
              </p>
            ) : order.location ? (
              <p className="mt-1.5 flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" /> {order.location.name}
              </p>
            ) : null}
          </div>
          <div className={cn("flex shrink-0 flex-col items-end rounded-xl px-2.5 py-1.5", URGENCY.chip)}>
            <span className="flex items-center gap-1 font-mono text-xl leading-none font-bold tabular">
              {urgency === "critical" ? <AlertTriangle className="size-4" /> : <Clock className="size-4" />}
              {formatElapsed(order.elapsedSeconds)}
            </span>
            <span className="mt-0.5 text-xs font-semibold opacity-90">{URGENCY.label}</span>
          </div>
        </div>
        {order.table?.room?.name && (
          <p className="text-xs text-muted-foreground">{order.table.room.name}</p>
        )}
        <div className="flex items-center gap-2" aria-label={`${readyCount} de ${order.items.length} artículos listos`}>
          <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-success transition-[width] duration-500 ease-(--ease-out-expo)"
              style={{ width: `${progress * 100}%` }}
            />
          </span>
          <span className="text-xs font-semibold text-muted-foreground tabular">
            {readyCount}/{order.items.length}
          </span>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {order.items.map((item) => {
          const isReady = item.itemStatus === "ready" || item.itemStatus === "served";
          const isPreparing = item.itemStatus === "preparing";
          return (
            <div
              key={item.id}
              className={cn(
                "flex flex-col gap-3 rounded-xl border p-3 transition-colors duration-300",
                isReady ? "border-success/30 bg-success/8" : isPreparing ? "border-warning/40 bg-warning/8" : "bg-card"
              )}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={cn(
                    "flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg px-1.5 text-lg font-bold tabular",
                    isReady ? "bg-success text-success-foreground" : "bg-foreground text-background"
                  )}
                >
                  {Number(item.quantity)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-base leading-snug font-semibold", isReady && "text-muted-foreground line-through decoration-2")}>
                    {item.productName}
                    {item.variantName && item.variantName !== "Default" && <span className="font-normal text-muted-foreground"> · {item.variantName}</span>}
                  </p>
                  {item.selectedOptions && Array.isArray(item.selectedOptions) && item.selectedOptions.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {item.selectedOptions.map((opt: { optionName: string; values: { value: string }[] }, idx: number) => (
                        <span key={idx} className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-foreground/80">
                          <span className="text-muted-foreground">{opt.optionName}:</span> {opt.values?.map((v: { value: string }) => v.value).join(", ")}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.comment && (
                    <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-warning/15 px-2 py-1.5 text-sm font-medium text-foreground">
                      <StickyNote className="mt-0.5 size-3.5 shrink-0 text-warning-ink" />
                      {item.comment}
                    </p>
                  )}
                </div>
                {isReady && (
                  <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-success-ink">
                    <Check className="size-4" strokeWidth={3} /> Listo
                  </span>
                )}
              </div>

              {!isReady && (
                <div className="flex gap-2">
                  {item.itemStatus === "pending" && (
                    <Button
                      variant="outline"
                      className="h-12 flex-1 text-sm desk:h-10"
                      onClick={() => handleItemStatus(item.id, "preparing")}
                      disabled={updating === item.id}
                    >
                      <Flame className="size-4" />
                      Cocinar
                    </Button>
                  )}
                  <Button
                    className="h-12 flex-1 bg-success text-sm text-success-foreground hover:bg-success/90 desk:h-10"
                    onClick={() => handleItemStatus(item.id, "ready")}
                    disabled={updating === item.id}
                  >
                    {updating === item.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    Listo
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Acción principal de la orden */}
      <footer className="border-t p-3">
        {order.status === "pending" && (
          <Button
            className="h-14 w-full rounded-xl text-base font-semibold desk:h-12"
            onClick={() => handleOrderAction("start")}
            disabled={updating === "order"}
          >
            <ChefHat className="size-5" />
            Iniciar preparación
          </Button>
        )}
        {order.status === "preparing" && (
          <Button
            className="h-14 w-full rounded-xl bg-success text-base font-semibold text-success-foreground hover:bg-success/90 desk:h-12"
            onClick={() => handleOrderAction("ready")}
            disabled={updating === "order"}
          >
            <Check className="size-5" />
            Marcar todo listo
          </Button>
        )}
        {order.status === "ready" && (
          <Button
            className="h-14 w-full rounded-xl bg-info text-base font-semibold text-info-foreground hover:bg-info/90 desk:h-12"
            onClick={() => handleOrderAction("complete")}
            disabled={updating === "order"}
          >
            <BellRing className="size-5" />
            Entregado
          </Button>
        )}
      </footer>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/*  KitchenDisplay                                                     */
/* ------------------------------------------------------------------ */

interface KitchenDisplayProps {
  locationId?: string;
  refreshInterval?: number; // ms
}

export function KitchenDisplay({ locationId, refreshInterval = 10000 }: KitchenDisplayProps) {
  const { data: session } = useSession();
  const [orders, setOrders] = useState<KDSOrder[]>([]);
  const [stats, setStats] = useState<KDSStats | null>(null);
  const [upcomingReservations, setUpcomingReservations] = useState<UpcomingReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  // Campana visual: banner efímero al confirmarse una reservación próxima.
  const [arrivalAlert, setArrivalAlert] = useState<{
    tableNumber: number | string;
    time: string;
    guests: number;
  } | null>(null);
  const arrivalAlertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Estado SSE reportado al badge "En vivo" del encabezado de la página.
  const registerSse = useSseStore((s) => s.register);
  const unregisterSse = useSseStore((s) => s.unregister);
  const setSseStatus = useSseStore((s) => s.setStatus);
  const setSseConnected = useCallback(
    (connected: boolean) => setSseStatus("kitchen", connected ? "connected" : "reconnecting"),
    [setSseStatus]
  );
  const sseConnected = useSseStore((s) => s.sources["kitchen"]?.connected ?? false);

  // Aviso de datos desactualizados si el stream de la parrilla se cae y el
  // último refresco exitoso ya lleva más de un minuto.
  const { stale: dataStale, markFresh } = useStaleData(sseConnected);
  const prevOrderCount = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initial load (one-time fetch)
  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (locationId) params.set("locationId", locationId);
      const res = await fetch(`/api/kds?${params}`).then((r) => r.json());
      if (res.ok) {
        if (soundEnabled && res.orders.length > prevOrderCount.current && prevOrderCount.current > 0) {
          playNotificationSound();
        }
        prevOrderCount.current = res.orders.length;
        setOrders(res.orders);
        setStats(res.stats);
        setUpcomingReservations(res.upcomingReservations ?? []);
        markFresh();
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [locationId, soundEnabled, markFresh]);

  useEffect(() => { load(); }, [load]);

  // SSE subscription for real-time updates
  useEffect(() => {
    if (typeof window === "undefined") return;

    let es: EventSource | null = null;
    let retries = 0;
    let closed = false;

    registerSse("kitchen");

    const connect = () => {
      const params = new URLSearchParams();
      if (locationId) params.set("locationId", locationId);
      es = new EventSource(`/api/kds/stream?${params}`);

      es.onopen = () => {
        retries = 0;
        setSseConnected(true);
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as {
            orders?: KDSOrder[];
            type?: string;
            orderId?: string;
            orderNumber?: string | number;
            status?: string;
            items?: KDSOrder["items"];
            table?: KDSOrder["table"];
            elapsedSeconds?: number;
            // reservation_confirmed: aviso de llegada.
            startsAt?: string;
            guests?: number;
            guestName?: string | null;
          };

          // Initial snapshot with full order list
          if (Array.isArray(data.orders)) {
            if (soundEnabled && data.orders.length > prevOrderCount.current && prevOrderCount.current > 0) {
              playNotificationSound();
            }
            prevOrderCount.current = data.orders.length;
            setOrders(data.orders);
            // Recalculate stats from orders
            setStats({
              pending: data.orders.filter((o: KDSOrder) => o.status === "pending").length,
              confirmed: data.orders.filter((o: KDSOrder) => o.status === "confirmed").length,
              preparing: data.orders.filter((o: KDSOrder) => o.status === "preparing").length,
              totalItems: data.orders.reduce((sum: number, o: KDSOrder) => sum + o.items.length, 0),
              readyItems: data.orders.reduce((sum: number, o: KDSOrder) => sum + o.items.filter((i) => i.itemStatus === "ready").length, 0),
            });
            return;
          }

          // Cambió una reservación de mesa (confirmada/cancelada/sentada):
          // recargar la tira "Próximas reservas" sin tocar las órdenes.
          if (data.type === "reservations_changed") {
            void load();
            return;
          }

          // Campana: el anfitrión confirmó una reservación PRÓXIMA (con mesa
          // y hora dentro de la ventana) → avisar al equipo con sonido y
          // banner efímero, sin tener que mirar la tira.
          if (data.type === "reservation_confirmed") {
            if (soundEnabled) playSound("reservation-bell", { volume: 1 });
            setArrivalAlert({
              tableNumber: data.table?.number ?? "?",
              time: data.startsAt
                ? new Date(data.startsAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
                : "",
              guests: data.guests ?? 0,
            });
            if (arrivalAlertTimer.current) clearTimeout(arrivalAlertTimer.current);
            arrivalAlertTimer.current = setTimeout(() => setArrivalAlert(null), 10_000);
            void load();
            return;
          }

          // Individual order update
          if (data.type && data.orderId) {
            setOrders((prev) => {
              let next: KDSOrder[];
              if (data.type === "order_removed") {
                next = prev.filter((o) => o.id !== data.orderId);
              } else {
                const exists = prev.some((o) => o.id === data.orderId);
                const updated: KDSOrder = {
                  id: data.orderId!,
                  orderNumber: data.orderNumber ?? "",
                  status: data.status ?? "pending",
                  createdAt: new Date().toISOString(),
                  elapsedSeconds: data.elapsedSeconds ?? 0,
                  table: data.table ?? null,
                  location: null,
                  items: (data.items ?? []).map((i) => ({
                    ...i,
                    selectedOptions: null,
                    comment: null,
                  })),
                  preparation: null,
                };
                if (exists) {
                  next = prev.map((o) => (o.id === data.orderId ? updated : o));
                } else {
                  next = [...prev, updated];
                  // Play sound for new orders
                  if (soundEnabled) playNotificationSound();
                }
              }
              prevOrderCount.current = next.length;
              // Recalculate stats
              setStats({
                pending: next.filter((o) => o.status === "pending").length,
                confirmed: next.filter((o) => o.status === "confirmed").length,
                preparing: next.filter((o) => o.status === "preparing").length,
                totalItems: next.reduce((sum, o) => sum + o.items.length, 0),
                readyItems: next.reduce((sum, o) => sum + o.items.filter((i) => i.itemStatus === "ready").length, 0),
              });
              return next;
            });
          }
        } catch {
          // Ignorar mensajes no JSON
        }
      };

      es.onerror = () => {
        es?.close();
        setSseConnected(false);
        if (!closed && retries < 6) {
          retries += 1;
          const delay = Math.min(1000 * 2 ** retries, 15_000);
          setTimeout(connect, delay);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      es?.close();
      unregisterSse("kitchen");
    };
  }, [locationId, soundEnabled]);

  const playNotificationSound = () => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio("/sounds/notification.mp3");
      }
      audioRef.current.play().catch(() => {});
    } catch {
      // silently fail
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] space-y-5 rounded-2xl bg-surface-sunken p-3 sm:p-5">
      {/* Header bar */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ChefHat className="w-7 h-7" />
            Cocina
          </h2>
          {stats && (
            <div className="flex gap-3 text-sm">
              <Badge variant="outline" className="bg-warning/10 text-warning-ink border-warning/30">
                <Clock className="w-3 h-3 mr-1" />
                {stats.pending + stats.confirmed + stats.preparing} órdenes
              </Badge>
              <Badge variant="outline" className="bg-success/10 text-success-ink border-success/30">
                <Check className="w-3 h-3 mr-1" />
                {stats.readyItems}/{stats.totalItems} artículos listos
              </Badge>
            </div>
          )}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {/* Operador de la sesión: demo walkers saben qué rol está activo. */}
          {session?.user?.name || session?.user?.roleName ? (
            <div className="hidden items-center gap-1.5 rounded-md bg-card py-0.5 pl-2 pr-1 text-muted-foreground ring-1 ring-border md:flex">
              <span className="max-w-32 truncate text-xs font-medium">
                {session.user.name}
              </span>
              <RoleBadge
                roleName={session.user.roleName}
                role={session.user.role}
              />
            </div>
          ) : null}
          <Button
            variant={soundEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-label={soundEnabled ? "Desactivar alertas sonoras" : "Activar alertas sonoras"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{soundEnabled ? "Sonido activo" : "Sin sonido"}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={load}>
            Actualizar
          </Button>
        </div>
      </div>

      <StaleBanner show={dataStale} />

      {stats && (
        <div className="grid grid-cols-3 gap-2" aria-label="Resumen de cocina">
          {[["Por iniciar", stats.pending + stats.confirmed, "text-warning-ink bg-warning/10"], ["Preparando", stats.preparing, "text-info-ink bg-info/10"], ["Artículos listos", stats.readyItems, "text-success-ink bg-success/10"]].map(([label, value, tone]) => (
            <div key={String(label)} className={cn("flex items-baseline justify-center gap-2 rounded-xl px-3 py-2.5", tone)}><strong className="text-3xl leading-none font-bold tabular-nums">{value}</strong><span className="text-sm font-semibold">{label}</span></div>
          ))}
        </div>
      )}

      {/* Campana visual: nueva reservación próxima confirmada (auto-desaparece). */}
      {arrivalAlert && (
        <div
          role="status"
          className="flex animate-rise-in items-center gap-2 rounded-xl border border-violet-400 bg-violet-100 px-3.5 py-3 text-base font-semibold text-violet-900 shadow-e2 dark:border-violet-500/60 dark:bg-violet-500/20 dark:text-violet-100"
        >
          <Bell className="size-4 shrink-0" />
          Nueva reservación confirmada: Mesa {arrivalAlert.tableNumber}
          {arrivalAlert.time ? ` · ${arrivalAlert.time}` : ""} · {arrivalAlert.guests}{" "}
          {arrivalAlert.guests === 1 ? "persona" : "personas"}
        </div>
      )}

      {/* Aviso de llegada: reservaciones confirmadas próximas — el anfitrión/la
          cocina preparan el lugar. */}
      {upcomingReservations.length > 0 && (
        <div className="rounded-xl border border-violet-300/70 bg-violet-50 px-3.5 py-2.5 dark:border-violet-500/40 dark:bg-violet-500/10">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
            <CalendarCheck2 className="size-3.5" />
            Próximas reservas — prepara el lugar
          </div>
          <div className="flex flex-wrap gap-2">
            {upcomingReservations.map((r) => (
              <Badge
                key={r.id}
                variant="outline"
                className="gap-1.5 border-violet-300/70 bg-card px-2.5 py-1.5 text-sm text-violet-800 dark:border-violet-500/40 dark:text-violet-200"
              >
                <Armchair className="size-3" />
                Mesa {r.table?.number ?? "?"}
                {r.table?.room?.name ? ` · ${r.table.room.name}` : ""}
                <span className="font-mono font-bold">
                  {new Date(r.startsAt).toLocaleTimeString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="opacity-70">
                  {r.guests} {r.guests === 1 ? "pers." : "pers."}
                </span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Orders grid */}
      {orders.length === 0 ? (
        <div className="flex h-72 flex-col items-center justify-center rounded-2xl border border-dashed bg-card px-6 text-center text-muted-foreground">
          <span className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
            <ChefHat className="size-8" />
          </span>
          <p className="text-xl font-semibold text-foreground">Cocina al día</p>
          <p className="text-sm">Las nuevas órdenes aparecerán aquí automáticamente.</p>
          <p className="mt-1 max-w-md text-xs">Cuando llegue una orden, inicia su preparación desde la tarjeta, marca cada artículo listo y finalmente avisa que el pedido está completo.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={load}>Comprobar ahora</Button>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] items-start gap-4">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} onUpdate={load} />
          ))}
        </div>
      )}
    </div>
  );
}
