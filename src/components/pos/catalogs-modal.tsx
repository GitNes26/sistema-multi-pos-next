"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList, Eye, Star, Search, Sparkles, Target } from "lucide-react";
import { DialogComponent } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { usePosStore } from "@/stores/pos-store";
import type { PosOrder, PosProduct, PosPromotion } from "@/types/pos";
import { money } from "@/lib/pos/money";
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from "@/lib/pos/config";
import { promotionScheduleLabel, pointsToMoney } from "@/lib/pos/pricing";
import { cn } from "@/lib/utils";
import { ProductCard } from "./product-card";
import { PosOrderDetail } from "./pos-order-detail";
import { usePosTotals } from "@/hooks/use-pos-totals";

interface CatalogsModalProps {
  open: boolean;
  onClose: () => void;
  onSelectProduct: (product: PosProduct) => void;
}

/** Calcula el progreso de una promoción respecto al ticket actual. */
function promoProgress(p: PosPromotion, subtotal: number, categoryTotals: Map<string, number>, productTotals: Map<string, number>): { pct: number; current: number; needed: number; label: string } {
  const minAmt = p.minAmount;
  const minQty = p.minQuantity;

  // Si no tiene requisitos mínimos → 100%
  if (minAmt <= 0 && minQty <= 0) return { pct: 100, current: 0, needed: 0, label: "" };

  let current = 0;
  let needed = 0;

  if (p.scope === "order") {
    current = subtotal;
    needed = minAmt;
  } else if (p.scope === "category") {
    // Sumar totales de las categorías objetivo
    const targetCats = p.targets.filter((t) => t.kind === "category").map((t) => t.targetId);
    if (targetCats.length > 0) {
      for (const catId of targetCats) current += categoryTotals.get(catId) ?? 0;
    } else {
      current = subtotal; // Sin targets específicos = todas
    }
    needed = minAmt;
  } else if (p.scope === "product") {
    const targetProds = p.targets.filter((t) => t.kind === "product").map((t) => t.targetId);
    if (targetProds.length > 0) {
      for (const prodId of targetProds) current += productTotals.get(prodId) ?? 0;
    }
    needed = minAmt;
  } else if (p.scope === "variant") {
    const targetVars = p.targets.filter((t) => t.kind === "variant").map((t) => t.targetId);
    if (targetVars.length > 0) {
      for (const varId of targetVars) current += productTotals.get(varId) ?? 0;
    }
    needed = minAmt;
  }

  if (needed <= 0) return { pct: 100, current, needed: 0, label: "" };

  const pct = Math.min(100, Math.round((current / needed) * 100));
  const remaining = Math.max(0, needed - current);
  const label = remaining > 0 ? `Te faltan ${money(remaining)}` : "¡Meta alcanzada!";
  return { pct, current, needed, label };
}

export function CatalogsModal({ open, onClose, onSelectProduct }: CatalogsModalProps) {
  const products = usePosStore((s) => s.products);
  const customers = usePosStore((s) => s.customers);
  const promotions = usePosStore((s) => s.promotions);
  const loyalty = usePosStore((s) => s.loyalty);
  const items = usePosStore((s) => s.items);
  const t = usePosTotals();

  const [orders, setOrders] = useState<PosOrder[]>([]);
  const [today, setToday] = useState<{ total: number; count: number }>({ total: 0, count: 0 });
  const [activeTab, setActiveTab] = useState("pedidos");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const aliveRef = useRef(true);

  // Search states
  const [searchOrders, setSearchOrders] = useState("");
  const [searchProducts, setSearchProducts] = useState("");
  const [searchCustomers, setSearchCustomers] = useState("");
  const [searchPromos, setSearchPromos] = useState("");

  // Calcular totales por categoría y producto para el progreso
  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of items) {
      if (i.categoryId) map.set(i.categoryId, (map.get(i.categoryId) ?? 0) + i.unitPrice * i.qty);
    }
    return map;
  }, [items]);

  const productTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of items) {
      const key = i.variantId ?? i.productId;
      map.set(key, (map.get(key) ?? 0) + i.unitPrice * i.qty);
    }
    return map;
  }, [items]);

  // Filtrados
  const filteredOrders = useMemo(() => {
    if (!searchOrders.trim()) return orders;
    const q = searchOrders.toLowerCase();
    return orders.filter((o) =>
      String(o.orderNumber).includes(q) ||
      (o.customerName ?? "").toLowerCase().includes(q) ||
      o.status.includes(q)
    );
  }, [orders, searchOrders]);

  const filteredProducts = useMemo(() => {
    if (!searchProducts.trim()) return products;
    const q = searchProducts.toLowerCase();
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.sku ?? "").toLowerCase().includes(q) ||
      (p.categoryName ?? "").toLowerCase().includes(q)
    );
  }, [products, searchProducts]);

  const filteredCustomers = useMemo(() => {
    if (!searchCustomers.trim()) return customers;
    const q = searchCustomers.toLowerCase();
    return customers.filter((c) =>
      c.fullName.toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.customerCode ?? "").toLowerCase().includes(q)
    );
  }, [customers, searchCustomers]);

  const filteredPromos = useMemo(() => {
    if (!searchPromos.trim()) return promotions;
    const q = searchPromos.toLowerCase();
    return promotions.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.scope.includes(q) ||
      p.benefit.includes(q)
    );
  }, [promotions, searchPromos]);

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

  // Buscador genérico por tab
  const searchInput = (value: string, onChange: (v: string) => void, placeholder: string) => (
    <div className="relative mb-2">
      <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 pl-8 text-xs"
      />
    </div>
  );

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

        {/* ── PEDIDOS ── */}
        <TabsContent value="pedidos" className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Ventas de hoy: <span className="font-semibold text-foreground">{today.count}</span> ·{" "}
            <span className="font-semibold text-foreground">{money(today.total)}</span>. Actualiza cada 15s.
          </p>
          {searchInput(searchOrders, setSearchOrders, "Buscar por #, cliente o estado…")}
          {filteredOrders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {orders.length === 0 ? "Sin pedidos recientes en esta sucursal." : "Sin resultados."}
            </p>
          ) : (
            <div className="space-y-1.5">
              {filteredOrders.map((o) => (
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

        {/* ── PRODUCTOS ── */}
        <TabsContent value="productos">
          {searchInput(searchProducts, setSearchProducts, "Buscar por nombre, SKU o categoría…")}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
            {filteredProducts.map((p) => (
              <ProductCard key={p.id} product={p} onSelect={onSelectProduct} />
            ))}
          </div>
          {filteredProducts.length === 0 && products.length > 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin resultados.</p>
          )}
        </TabsContent>

        {/* ── CLIENTES ── */}
        <TabsContent value="clientes">
          {searchInput(searchCustomers, setSearchCustomers, "Buscar por nombre, teléfono o código…")}
          <div className="space-y-1.5">
            {filteredCustomers.map((c) => (
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
          {filteredCustomers.length === 0 && customers.length > 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin resultados.</p>
          )}
        </TabsContent>

        {/* ── PROMOS ── */}
        <TabsContent value="promos">
          {searchInput(searchPromos, setSearchPromos, "Buscar por nombre, alcance o beneficio…")}
          <div className="space-y-2">
            {filteredPromos.map((p) => {
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

              const prog = promoProgress(p, t.subtotal, categoryTotals, productTotals);
              const nearReady = prog.pct >= 75 && prog.pct < 100;

              return (
                <div
                  key={p.id}
                  className={cn(
                    "rounded-xl border bg-card px-3 py-2.5",
                    prog.pct >= 100 && "border-emerald-500/40 bg-emerald-500/5",
                    nearReady && "border-amber-500/40 bg-amber-500/5"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {prog.pct >= 100 && <Sparkles className="size-3.5 shrink-0 text-emerald-500" />}
                      {nearReady && <Target className="size-3.5 shrink-0 text-amber-500" />}
                      <p className="truncate text-sm font-medium">{p.name}</p>
                    </div>
                    <Badge variant={prog.pct >= 100 ? "default" : "secondary"}>{scope}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {benefit}
                    {p.minAmount > 0 && ` · desde ${money(p.minAmount)}`}
                    {p.couponCode && ` · código ${p.couponCode}`}
                  </p>
                  {promotionScheduleLabel(p) && (
                    <p className="text-[11px] text-muted-foreground">{promotionScheduleLabel(p)}</p>
                  )}

                  {/* Progress bar */}
                  {p.minAmount > 0 && t.subtotal > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-muted-foreground">
                          {money(prog.current)} de {money(prog.needed)}
                        </span>
                        <span className={cn(
                          "font-semibold",
                          prog.pct >= 100 ? "text-emerald-600" : prog.pct >= 75 ? "text-amber-600" : "text-muted-foreground"
                        )}>
                          {prog.pct}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            prog.pct >= 100 ? "bg-emerald-500" : prog.pct >= 75 ? "bg-amber-500" : "bg-primary"
                          )}
                          style={{ width: `${prog.pct}%` }}
                        />
                      </div>
                      {prog.label && (
                        <p className={cn(
                          "mt-0.5 text-[10px]",
                          prog.pct >= 100 ? "text-emerald-600 font-medium" : "text-muted-foreground"
                        )}>
                          {prog.label}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredPromos.length === 0 && promotions.length > 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Sin resultados.</p>
            )}
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
