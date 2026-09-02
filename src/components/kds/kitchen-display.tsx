"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChefHat,
  Clock,
  Loader2,
  MapPin,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  table: { id: string; number: number; name: string | null } | null;
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getOrderUrgency(seconds: number): string {
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
  const urgencyBorder = {
    critical: "border-red-500 shadow-red-500/20 animate-pulse",
    warning: "border-amber-400 shadow-amber-400/20",
    normal: "border-slate-200 dark:border-slate-700",
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
    <Card className={cn("transition-all duration-300", urgencyBorder)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">#{order.orderNumber}</span>
            {order.table && (
              <Badge variant="outline" className="text-xs">
                <MapPin className="w-3 h-3 mr-1" />
                Mesa {order.table.number}
                {order.table.name && ` · ${order.table.name}`}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-mono font-bold",
              urgency === "critical" ? "bg-red-100 text-red-700" :
              urgency === "warning" ? "bg-amber-100 text-amber-700" :
              "bg-slate-100 text-slate-600"
            )}>
              <Clock className="w-3 h-3" />
              {formatElapsed(order.elapsedSeconds)}
            </div>
            {urgency === "critical" && (
              <AlertTriangle className="w-5 h-5 text-red-500 animate-bounce" />
            )}
          </div>
        </div>
        {order.location && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {order.location.name}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Items */}
        <div className="space-y-2">
          {order.items.map((item) => {
            const isReady = item.itemStatus === "ready" || item.itemStatus === "served";
            const isPreparing = item.itemStatus === "preparing";
            return (
              <div
                key={item.id}
                className={cn(
                  "flex items-center justify-between p-2 rounded-lg border transition-all",
                  isReady ? "bg-emerald-50 border-emerald-200" :
                  isPreparing ? "bg-amber-50 border-amber-200" :
                  "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm w-8 text-center">
                    {Number(item.quantity)}x
                  </span>
                  <div>
                    <p className={cn("text-sm font-medium", isReady && "line-through opacity-60")}>
                      {item.productName}
                      {item.variantName && <span className="text-muted-foreground"> · {item.variantName}</span>}
                    </p>
                    {/* Selected options */}
                    {item.selectedOptions && Array.isArray(item.selectedOptions) && item.selectedOptions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {item.selectedOptions?.map((opt: { optionName: string; values: { value: string }[] }, idx: number) => (
                          <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                            {opt.optionName}: {opt.values?.map((v: { value: string }) => v.value).join(", ")}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Comment */}
                    {item.comment && (
                      <p className="text-[10px] text-amber-600 italic mt-0.5">
                        📝 {item.comment}
                      </p>
                    )}
                  </div>
                </div>

                {/* Item status buttons */}
                <div className="flex gap-1">
                  {item.itemStatus === "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => handleItemStatus(item.id, "preparing")}
                      disabled={updating === item.id}
                    >
                      <Loader2 className="w-3 h-3 mr-1" />
                      Cocinar
                    </Button>
                  )}
                  {(item.itemStatus === "pending" || item.itemStatus === "preparing") && (
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-emerald-500 hover:bg-emerald-600"
                      onClick={() => handleItemStatus(item.id, "ready")}
                      disabled={updating === item.id}
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Listo
                    </Button>
                  )}
                  {isReady && (
                    <Badge className="bg-emerald-500 text-white text-[10px]">
                      <Check className="w-3 h-3 mr-0.5" /> Listo
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Order actions */}
        <div className="flex gap-2 pt-2 border-t">
          {order.status === "pending" && (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => handleOrderAction("start")}
              disabled={updating === "order"}
            >
              <ChefHat className="w-4 h-4 mr-1" />
              Iniciar preparación
            </Button>
          )}
          {order.status === "preparing" && (
            <Button
              size="sm"
              className="flex-1 bg-emerald-500 hover:bg-emerald-600"
              onClick={() => handleOrderAction("ready")}
              disabled={updating === "order"}
            >
              <Check className="w-4 h-4 mr-1" />
              Marcar todo listo
            </Button>
          )}
          {order.status === "ready" && (
            <Button
              size="sm"
              className="flex-1 bg-blue-500 hover:bg-blue-600"
              onClick={() => handleOrderAction("complete")}
              disabled={updating === "order"}
            >
              <Check className="w-4 h-4 mr-1" />
              Entregado
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
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
  const [orders, setOrders] = useState<KDSOrder[]>([]);
  const [stats, setStats] = useState<KDSStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);
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
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [locationId, soundEnabled]);

  useEffect(() => { load(); }, [load]);

  // SSE subscription for real-time updates
  useEffect(() => {
    if (typeof window === "undefined") return;

    let es: EventSource | null = null;
    let retries = 0;
    let closed = false;

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
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ChefHat className="w-7 h-7" />
            Cocina
          </h2>
          {stats && (
            <div className="flex gap-3 text-sm">
              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                <Clock className="w-3 h-3 mr-1" />
                {stats.pending + stats.confirmed + stats.preparing} órdenes
              </Badge>
              <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300">
                <Check className="w-3 h-3 mr-1" />
                {stats.readyItems}/{stats.totalItems} artículos listos
              </Badge>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <div className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
            sseConnected
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          )}>
            <div className={cn("w-2 h-2 rounded-full", sseConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-400")} />
            {sseConnected ? "En vivo" : "Sin conexión"}
          </div>
          <Button
            variant={soundEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="sm" onClick={load}>
            Actualizar
          </Button>
        </div>
      </div>

      {/* Orders grid */}
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <ChefHat className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">Sin órdenes pendientes</p>
          <p className="text-sm">Las nuevas órdenes aparecerán aquí automáticamente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} onUpdate={load} />
          ))}
        </div>
      )}
    </div>
  );
}
