"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChefHat,
  ClipboardList,
  Loader2,
  Minus,
  Plus,
  QrCode,
  Receipt,
  Search,
  ShoppingBag,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogComponent } from "@/components/ui/dialog";
import { InputGroupField } from "@/components/base/input-group-field";
import { ThumbImage } from "@/components/base/thumb-image";
import { Spinner } from "@/components/base/spinner";
import { EmptyState } from "@/components/shared/empty-state";
import { ProductBuilder } from "@/components/pos/product-builder";
import type { PortalProduct } from "@/lib/portal/server";
import { money } from "@/lib/pos/money";
import { cn } from "@/lib/utils";

// Mesero digital: el comensal escanea el QR de su mesa, arma un carrito COMPARTIDO con sus
// acompañantes (el cajero/host lo ve en vivo) y lo manda a cocina. Lo ya enviado no se puede
// quitar ni disminuir desde aquí; solo agregar más o pedir la cuenta.

interface CartLine {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  imageUrl: string | null;
  quantity: number;
  unitPrice: number;
  extraPrice: number;
  options: { optionName: string; value: string; extraPrice: number }[];
  optionValueIds: string[];
  notes: string;
}

interface Account {
  orderNumber: number;
  status: string;
  total: number;
  items: { id: string; name: string; quantity: number; total: number; status: string; notes: string | null }[];
}

interface MenuData {
  table: { id: string; number: number; name: string | null };
  business: { name: string; logoUrl: string | null; locationName: string | null };
  categories: { id: string; name: string; parentId: string | null }[];
  products: PortalProduct[];
  cart: CartLine[];
  account: Account | null;
  updatedAt: string | null;
}

const ITEM_STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "En espera", tone: "bg-muted text-muted-foreground" },
  preparing: { label: "Preparando", tone: "bg-warning/15 text-warning-ink" },
  ready: { label: "Listo", tone: "bg-success/15 text-success-ink" },
  served: { label: "Servido", tone: "bg-success/15 text-success-ink" },
};

const lineKey = () => `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function DigitalMenu({ tableId, tableToken }: { tableId?: string; tableToken?: string }) {
  const [data, setData] = useState<MenuData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [builder, setBuilder] = useState<PortalProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [billBusy, setBillBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [popId, setPopId] = useState<{ id: string; n: number } | null>(null);
  const dirty = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastServerStamp = useRef<string | null>(null);

  const say = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 2600);
  };

  const load = useCallback(
    async (initial = false) => {
      if (!tableId || !tableToken) {
        setError("Escanea el QR de tu mesa para ver el menú y pedir.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/public/menu?table=${encodeURIComponent(tableId)}&token=${encodeURIComponent(tableToken)}`, { cache: "no-store" });
        const body = await res.json();
        if (!res.ok || !body.ok) throw new Error(body.error || "No se pudo cargar el menú");
        const next = body as MenuData & { ok: boolean };
        setData(next);
        // Otro comensal (o el cajero) cambió el carrito: se adopta salvo cambios locales pendientes.
        if (initial || (!dirty.current && next.updatedAt !== lastServerStamp.current)) setCart(next.cart);
        lastServerStamp.current = next.updatedAt;
        setError(null);
      } catch (e) {
        if (initial) setError(e instanceof Error ? e.message : "No se pudo cargar el menú");
      } finally {
        if (initial) setLoading(false);
      }
    },
    [tableId, tableToken]
  );

  useEffect(() => {
    void load(true);
  }, [load]);
  // Refresco suave: carrito compartido y estado de lo enviado (preparando/listo).
  useEffect(() => {
    const t = setInterval(() => void load(false), 6000);
    return () => clearInterval(t);
  }, [load]);

  // Guarda el carrito en el servidor (con debounce) para que la mesa y el cajero lo vean.
  const persist = useCallback(
    (lines: CartLine[]) => {
      if (!tableId || !tableToken) return;
      dirty.current = true;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          const res = await fetch("/api/public/menu/cart", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tableId,
              token: tableToken,
              items: lines.map((l) => ({
                key: l.key,
                productId: l.productId,
                variantId: l.variantId,
                quantity: l.quantity,
                optionValueIds: l.optionValueIds,
                notes: l.notes,
              })),
            }),
          });
          const body = await res.json().catch(() => ({}));
          if (res.ok && body.ok) setCart(body.cart as CartLine[]);
        } finally {
          dirty.current = false;
        }
      }, 450);
    },
    [tableId, tableToken]
  );

  const updateCart = (fn: (prev: CartLine[]) => CartLine[]) => {
    setCart((prev) => {
      const next = fn(prev);
      persist(next);
      return next;
    });
  };

  const products = data?.products ?? [];
  const categories = useMemo(() => {
    const used = new Set(products.map((p) => p.categoryId).filter(Boolean));
    return (data?.categories ?? []).filter((c) => used.has(c.id));
  }, [data, products]);

  const filtered = products.filter((p) => {
    if (!p.isAvailable) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (category && p.categoryId !== category) return false;
    return true;
  });

  const needsBuilder = (p: PortalProduct) => p.options.length > 0 || p.variants.length > 1;

  const addSimple = (p: PortalProduct, variantId: string | null, price: number, name: string, image: string | null, quantity = 1, optionValueIds: string[] = [], notes = "", options: CartLine["options"] = [], extra = 0) => {
    // Misma configuración = misma línea (suma cantidad).
    const same = cart.find(
      (l) => l.productId === p.productId && l.variantId === variantId && l.notes === notes && [...l.optionValueIds].sort().join() === [...optionValueIds].sort().join()
    );
    updateCart((prev) =>
      same
        ? prev.map((l) => (l.key === same.key ? { ...l, quantity: l.quantity + quantity } : l))
        : [...prev, { key: lineKey(), productId: p.productId, variantId, name, imageUrl: image, quantity, unitPrice: price + extra, extraPrice: extra, options, optionValueIds, notes }]
    );
    setPopId((c) => ({ id: p.id, n: (c?.n ?? 0) + 1 }));
  };

  const onAddClick = (p: PortalProduct) => {
    if (needsBuilder(p)) return setBuilder(p);
    const v = p.variants[0];
    addSimple(p, v?.id ?? null, v?.price ?? 0, p.name, v?.imageUrl ?? p.imageUrl);
  };

  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);
  const cartTotal = Math.round(cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0) * 100) / 100;

  const send = async () => {
    if (!tableId || !tableToken || cart.length === 0) return;
    setSending(true);
    try {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // Asegura que el servidor tenga exactamente este carrito antes de enviarlo.
      await fetch("/api/public/menu/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId,
          token: tableToken,
          items: cart.map((l) => ({ key: l.key, productId: l.productId, variantId: l.variantId, quantity: l.quantity, optionValueIds: l.optionValueIds, notes: l.notes })),
        }),
      });
      const res = await fetch("/api/public/menu/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId, token: tableToken }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "No se pudo enviar a cocina");
      dirty.current = false;
      setCart([]);
      setCartOpen(false);
      setConfirmSend(false);
      say("¡Pedido enviado a cocina!");
      await load(false);
      setAccountOpen(true);
    } catch (e) {
      say(e instanceof Error ? e.message : "No se pudo enviar a cocina");
    } finally {
      setSending(false);
    }
  };

  const askBill = async () => {
    if (!tableId || !tableToken) return;
    setBillBusy(true);
    try {
      const res = await fetch("/api/public/menu/bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId, token: tableToken }),
      });
      const body = await res.json().catch(() => ({}));
      say(res.ok && body.ok ? "Avisamos al personal: ya viene tu cuenta." : body.error || "No se pudo avisar");
    } finally {
      setBillBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <QrCode className="size-12 text-muted-foreground" />
        <h1 className="text-xl font-bold">Menú de la mesa</h1>
        <p className="text-sm text-muted-foreground">{error ?? "No se pudo cargar el menú."}</p>
        <Button onClick={() => { setLoading(true); void load(true); }}>Reintentar</Button>
      </div>
    );
  }

  const accountCount = data.account?.items.length ?? 0;

  return (
    <div className="min-h-dvh bg-background pb-28">
      <header className="sticky top-0 z-30 border-b bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto max-w-5xl space-y-3 px-4 py-3">
          <div className="flex items-center gap-3">
            {data.business.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.business.logoUrl} alt="" className="size-10 rounded-xl object-cover" />
            ) : (
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <UtensilsCrossed className="size-5" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-heading text-lg leading-tight font-bold">{data.business.name}</h1>
              <p className="text-xs text-muted-foreground">
                Mesa {data.table.number}
                {data.table.name ? ` · ${data.table.name}` : ""}
                {data.business.locationName ? ` · ${data.business.locationName}` : ""}
              </p>
            </div>
            <Button variant="outline" className="h-11 shrink-0 gap-1.5" onClick={() => setAccountOpen(true)}>
              <Receipt className="size-4" /> Mi cuenta
              {accountCount > 0 && <span className="rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">{accountCount}</span>}
            </Button>
          </div>
          <InputGroupField type="search" placeholder="Buscar en el menú…" value={search} onChange={(e) => setSearch(e.target.value)} leftIcon={<Search className="size-4" />} />
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {[{ id: "", name: "Todo" }, ...categories].map((c) => (
              <button
                key={c.id || "all"}
                type="button"
                onClick={() => setCategory(c.id)}
                className={cn(
                  "h-10 shrink-0 rounded-full px-4 text-sm font-medium whitespace-nowrap transition",
                  category === c.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/70"
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-4">
        {filtered.length === 0 ? (
          <EmptyState icon={Search} title="Sin resultados" description="No hay productos con esos filtros." />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((p) => {
              const price = Math.min(...p.variants.map((v) => v.price));
              const inCart = cart.filter((l) => l.productId === p.productId).reduce((s, l) => s + l.quantity, 0);
              return (
                <li key={p.id} className="relative overflow-hidden rounded-2xl border bg-card">
                  <button type="button" onClick={() => onAddClick(p)} className="flex h-full w-full flex-col text-left active:scale-[0.99]">
                    <span className="relative block aspect-[4/3] w-full bg-muted">
                      {p.imageUrl || p.variants[0]?.imageUrl ? (
                        <ThumbImage src={(p.imageUrl ?? p.variants[0]?.imageUrl) as string} alt={p.name} className="size-full object-cover" />
                      ) : (
                        <span className="grid size-full place-items-center text-muted-foreground">
                          <UtensilsCrossed className="size-8" />
                        </span>
                      )}
                      {inCart > 0 && (
                        <span className="absolute top-2 left-2 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">×{inCart}</span>
                      )}
                    </span>
                    <span className="flex flex-1 flex-col gap-1 p-3">
                      <span className="line-clamp-2 text-sm leading-snug font-semibold">{p.name}</span>
                      {p.description && <span className="line-clamp-2 text-xs text-muted-foreground">{p.description}</span>}
                      <span className="mt-auto flex items-center justify-between pt-1">
                        <span className="font-bold tabular-nums">
                          {p.variants.length > 1 ? "Desde " : ""}
                          {money(price)}
                        </span>
                        <span className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground">
                          <Plus className="size-4" />
                        </span>
                      </span>
                    </span>
                  </button>
                  <AnimatePresence>
                    {popId?.id === p.id && (
                      <motion.span
                        key={popId.n}
                        initial={{ opacity: 1, y: 0 }}
                        animate={{ opacity: 0, y: -26 }}
                        transition={{ duration: 0.7 }}
                        className="pointer-events-none absolute right-3 bottom-14 rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground"
                      >
                        +1
                      </motion.span>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {/* Barra de pedido */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-5xl gap-2">
          <Button className="h-14 flex-1 justify-between rounded-2xl text-base font-semibold" disabled={cartCount === 0} onClick={() => setCartOpen(true)}>
            <span className="flex items-center gap-2">
              <ShoppingBag className="size-5" /> Ver mi pedido
              {cartCount > 0 && <span className="rounded-full bg-primary-foreground/20 px-2 text-sm tabular-nums">{cartCount}</span>}
            </span>
            <span className="tabular-nums">{money(cartTotal)}</span>
          </Button>
        </div>
      </div>

      {/* Pedido (carrito compartido) */}
      <DialogComponent
        open={cartOpen}
        onOpenChange={(o) => {
          setCartOpen(o);
          if (!o) setConfirmSend(false);
        }}
        title="Tu pedido"
        description="Lo ve toda tu mesa y el personal. Aún puedes cambiarlo antes de enviarlo a cocina."
        icon={<ShoppingBag className="size-5" />}
        size="lg"
        bodyClassName="space-y-3"
        footer={
          cart.length > 0 ? (
            confirmSend ? (
              <>
                <Button variant="outline" className="h-12" onClick={() => setConfirmSend(false)} disabled={sending}>
                  Seguir editando
                </Button>
                <Button className="h-12 gap-2" onClick={() => void send()} disabled={sending}>
                  {sending ? <Loader2 className="size-4 animate-spin" /> : <ChefHat className="size-4" />}
                  Sí, enviar a cocina
                </Button>
              </>
            ) : (
              <Button className="h-12 w-full gap-2 text-base" onClick={() => setConfirmSend(true)}>
                <ChefHat className="size-5" /> Mandar a cocina · {money(cartTotal)}
              </Button>
            )
          ) : undefined
        }
      >
        {cart.length === 0 ? (
          <EmptyState icon={ShoppingBag} title="Tu pedido está vacío" description="Agrega productos del menú." />
        ) : (
          <>
            {confirmSend && (
              <p role="status" className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-warning-ink">
                Al enviarlo a cocina <b>ya no podrás quitar ni disminuir</b> estos artículos desde el menú; solo agregar más.
              </p>
            )}
            <ul className="space-y-2">
              {cart.map((l) => (
                <li key={l.key} className="flex gap-3 rounded-xl border p-3">
                  {l.imageUrl && <ThumbImage src={l.imageUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{l.name}</p>
                    {l.options.length > 0 && <p className="text-xs text-muted-foreground">{l.options.map((o) => o.value).join(", ")}</p>}
                    {l.notes && <p className="text-xs text-warning-ink italic">“{l.notes}”</p>}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex items-center rounded-lg bg-muted p-0.5">
                        <button
                          type="button"
                          aria-label="Quitar uno"
                          className="grid size-10 place-items-center rounded-md hover:bg-background"
                          onClick={() => updateCart((prev) => prev.flatMap((x) => (x.key === l.key ? (x.quantity <= 1 ? [] : [{ ...x, quantity: x.quantity - 1 }]) : [x])))}
                        >
                          {l.quantity <= 1 ? <Trash2 className="size-4 text-destructive" /> : <Minus className="size-4" />}
                        </button>
                        <span className="w-8 text-center text-sm font-bold tabular-nums">{l.quantity}</span>
                        <button
                          type="button"
                          aria-label="Agregar uno"
                          className="grid size-10 place-items-center rounded-md hover:bg-background"
                          onClick={() => updateCart((prev) => prev.map((x) => (x.key === l.key ? { ...x, quantity: Math.min(99, x.quantity + 1) } : x)))}
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                      <span className="ml-auto text-sm font-bold tabular-nums">{money(l.unitPrice * l.quantity)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t pt-3 text-lg font-bold">
              <span>Total del pedido</span>
              <span className="tabular-nums">{money(cartTotal)}</span>
            </div>
          </>
        )}
      </DialogComponent>

      {/* Mi cuenta: lo ya enviado a cocina (solo lectura) */}
      <DialogComponent
        open={accountOpen}
        onOpenChange={setAccountOpen}
        title={data.account ? `Mi cuenta · #${data.account.orderNumber}` : "Mi cuenta"}
        description="Lo que ya está en cocina. No se puede quitar desde aquí."
        icon={<ClipboardList className="size-5" />}
        size="lg"
        bodyClassName="space-y-3"
        footer={
          data.account ? (
            <Button className="h-12 w-full gap-2" onClick={() => void askBill()} disabled={billBusy}>
              {billBusy ? <Loader2 className="size-4 animate-spin" /> : <Receipt className="size-4" />} Pedir la cuenta
            </Button>
          ) : undefined
        }
      >
        {!data.account ? (
          <EmptyState icon={ClipboardList} title="Aún no has pedido" description="Cuando mandes tu pedido a cocina aparecerá aquí." />
        ) : (
          <>
            <ul className="divide-y rounded-xl border">
              {data.account.items.map((i) => {
                const st = ITEM_STATUS[i.status] ?? ITEM_STATUS.pending;
                return (
                  <li key={i.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-sm font-bold tabular-nums">{i.quantity}×</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{i.name}</span>
                      {i.notes && <span className="block truncate text-xs text-muted-foreground italic">“{i.notes}”</span>}
                    </span>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", st.tone)}>{st.label}</span>
                    <span className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums">{money(i.total)}</span>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Total consumido</span>
              <span className="tabular-nums">{money(data.account.total)}</span>
            </div>
            <p className="text-xs text-muted-foreground">El pago se realiza con el personal al pedir la cuenta.</p>
          </>
        )}
      </DialogComponent>

      {builder && (
        <ProductBuilder
          portalProduct={builder}
          open
          onClose={() => setBuilder(null)}
          onAdd={(config) => {
            const p = builder;
            const variant = (config.variant ? p.variants.find((v) => v.id === config.variant!.id) : null) ?? p.variants[0] ?? null;
            const options = config.selectedOptions.flatMap((o) => o.values.map((v) => ({ optionName: o.optionName, value: v.value, extraPrice: v.extraPrice })));
            const ids = config.selectedOptions.flatMap((o) => o.values.map((v) => v.id));
            const name = p.variants.length > 1 && variant ? `${p.name} · ${variant.name}` : p.name;
            addSimple(p, variant?.id ?? null, variant?.price ?? 0, name, variant?.imageUrl ?? p.imageUrl, config.quantity || 1, ids, config.notes.trim(), options, config.totalExtraPrice || 0);
            setBuilder(null);
          }}
        />
      )}

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            role="status"
            className="fixed top-[max(1rem,env(safe-area-inset-top))] left-1/2 z-[70] -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-e3"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
