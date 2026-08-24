"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardList, Eye, Star } from "lucide-react";
import { DialogComponent } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { usePosStore } from "@/stores/pos-store";
import type { PosOrder, PosProduct } from "@/types/pos";
import { money } from "@/lib/pos/money";
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from "@/lib/pos/config";
import { promotionScheduleLabel, pointsToMoney } from "@/lib/pos/pricing";
import { cn } from "@/lib/utils";
import { ProductCard } from "./product-card";
import { PosOrderDetail } from "./pos-order-detail";

interface CatalogsModalProps {
  open: boolean;
  onClose: () => void;
  onSelectProduct: (product: PosProduct) => void;
}

export function CatalogsModal({ open, onClose, onSelectProduct }: CatalogsModalProps) {
  const products = usePosStore((s) => s.products);
  const customers = usePosStore((s) => s.customers);
  const promotions = usePosStore((s) => s.promotions);
  const loyalty = usePosStore((s) => s.loyalty);

  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [today, setToday] = useState<{ total: number; count: number }>({ total: 0, count: 0 });
  const [activeTab, setActiveTab] = useState("pedidos");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const aliveRef = useRef(true);

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/pos/orders", { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) return;
      if (aliveRef.current) {
        setOrders(data.orders ?? []);
        setToday({ total: data.stats?.todaySales ?? 0, count: data.stats?.todayCount ?? 0 });
      }
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    void loadOrders();
    const timer = setInterval(loadOrders, 15000);
    return () => {
      aliveRef.current = false;
      clearInterval(timer);
    };
  }, [open, loadOrders]);

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      icon={<ClipboardList className="size-5 text-primary" />}
      title="Catálogos y pedidos"
      className="sm:max-w-3xl"
    >
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-1">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
            <TabsTrigger value="productos">Productos</TabsTrigger>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
            <TabsTrigger value="promos">Promos</TabsTrigger>
          </TabsList>

          <TabsContent value="pedidos" className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Ventas de hoy: <span className="font-semibold text-foreground">{today.count}</span> ·{" "}
              <span className="font-semibold text-foreground">{money(today.total)}</span>. Actualiza cada 15s.
            </p>
            {orders.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Sin pedidos recientes en esta sucursal.
              </p>
            ) : (
              <div className="space-y-1.5">
                {orders.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSelectedOrderId(o.id)}
                    className="flex w-full items-center gap-3 rounded-xl border bg-card px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 active:bg-muted"
                  >
                    <span
                      className={cn("size-2.5 shrink-0 rounded-full", ORDER_STATUS_COLORS[o.status])}
                      title={ORDER_STATUS_LABELS[o.status]}
                    />
                    <span className="font-semibold">{o.orderNumber}</span>
                    <span className="truncate text-muted-foreground">
                      {o.customerName ?? "Cliente desconocido"}
                    </span>
                    <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
                      {o.deliveryMethod === "delivery" ? "A domicilio" : "Recoger"}
                    </span>
                    <Badge variant="outline" className="shrink-0">
                      {ORDER_STATUS_LABELS[o.status]}
                    </Badge>
                    <span className="shrink-0 font-semibold tabular-nums">{money(o.total)}</span>
                    <Eye className="size-3.5 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="productos">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} onSelect={onSelectProduct} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="clientes">
            <div className="space-y-1.5">
              {customers.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {c.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{c.fullName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.phone ?? c.email ?? c.customerCode ?? "—"}
                    </span>
                  </span>
                  <span className="ml-auto flex flex-col items-end gap-0.5">
                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                      <Star className="size-3.5" /> {money(pointsToMoney(c.points, loyalty.pointValue))}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{Math.floor(c.points)} pts</span>
                  </span>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="promos">
            <div className="space-y-1.5">
              {promotions.map((p) => {
                const scope =
                  p.scope === "order"
                    ? "Pedido completo"
                    : p.scope === "category"
                      ? "Categoría"
                      : p.scope === "product"
                        ? "Producto"
                        : "Variante";
                const benefit =
                  p.benefit === "percent_off"
                    ? `${p.value}% de descuento`
                    : p.benefit === "amount_off"
                      ? `${money(p.value)} de descuento`
                      : p.benefit === "fixed_price"
                        ? `Precio fijo ${money(p.value)}`
                        : p.benefit === "buy_x_get_y"
                          ? `${p.buyQuantity} × ${p.getQuantity}`
                          : p.benefit === "free_item"
                            ? "Artículo gratis"
                            : "Cupón próxima compra";
                return (
                  <div key={p.id} className="rounded-xl border bg-card px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <Badge variant="secondary">{scope}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {benefit}
                      {p.minAmount > 0 && ` · desde ${money(p.minAmount)}`}
                      {p.couponCode && ` · código ${p.couponCode}`}
                    </p>
                    {promotionScheduleLabel(p) && (
                      <p className="text-[11px] text-muted-foreground">{promotionScheduleLabel(p)}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </TabsContent>
          </Tabs>
          {selectedOrderId && (
            <PosOrderDetail
              orderId={selectedOrderId}
              onClose={() => setSelectedOrderId(null)}
              onChanged={() => {
                setSelectedOrderId(null);
                void loadOrders();
              }}
            />
          )}
    </DialogComponent>
  );
}