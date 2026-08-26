"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Save, Search, Trash2, Pencil, PackagePlus, Check } from "lucide-react";
import { portalApi } from "@/lib/portal/client";
import type { ShoppingListView } from "@/lib/portal/server";
import { money, round3 } from "@/lib/pos/money";
import { usePortalStore } from "@/stores/portal-store";
import { swalError, swalPrompt, swalToast } from "@/lib/swal";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/portal/bottom-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { SwipeableRow } from "@/components/shared/swipeable-row";

interface DraftItem {
  id?: string;
  variantId: string;
  productName: string;
  variantName: string | null;
  price: number;
  quantity: number;
}

export function ListDetailClient({ listId }: { listId: string }) {
  const router = useRouter();
  const [list, setList] = useState<ShoppingListView | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");

  const products = usePortalStore((s) => s.products);
  const setStorefront = usePortalStore((s) => s.setStorefront);

  useEffect(() => {
    let active = true;
    Promise.all([portalApi.list(listId), portalApi.storefront()])
      .then(([d, store]) => {
        if (!active) return;
        setList(d.list);
        setItems(
          d.list.items.map((i) => ({
            id: i.id,
            variantId: i.variantId,
            productName: i.productName,
            variantName: i.variantName,
            price: i.price,
            quantity: i.quantity,
          }))
        );
        setStorefront(store.categories, store.products);
      })
      .catch((e) => {
        if (active) swalError("No se pudo cargar la lista", e instanceof Error ? e.message : undefined);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [listId, setStorefront]);

  const standardProducts = useMemo(
    () => products.filter((p) => p.kind === "standard" && p.variants.length > 0),
    [products]
  );

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return standardProducts;
    return standardProducts.filter((p) => p.name.toLowerCase().includes(q));
  }, [standardProducts, search]);

  const rename = async () => {
    if (!list) return;
    const name = await swalPrompt("Renombrar lista", "Nombre de la lista…", list.name);
    if (!name || name === list.name) return;
    setList((prev) => (prev ? { ...prev, name } : prev));
  };

  const addVariant = (productName: string, variantName: string | null, variantId: string, price: number) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === variantId);
      if (existing) {
        return prev.map((i) => (i.variantId === variantId ? { ...i, quantity: round3(i.quantity + 1) } : i));
      }
      return [...prev, { variantId, productName, variantName, price, quantity: 1 }];
    });
  };

  const changeQty = (variantId: string, delta: number) => {
    setItems((prev) =>
      prev.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.max(1, round3(i.quantity + delta)) } : i))
    );
  };

  const removeItem = (variantId: string) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId));
  };

  const save = async () => {
    if (!list) return;
    setSaving(true);
    try {
      const res = await portalApi.updateList(listId, {
        name: list.name,
        notes: list.notes,
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      });
      setList(res.list);
      setItems(
        res.list.items.map((i) => ({
          id: i.id,
          variantId: i.variantId,
          productName: i.productName,
          variantName: i.variantName,
          price: i.price,
          quantity: i.quantity,
        }))
      );
      swalToast("Lista guardada");
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-8 w-40 rounded-xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (!list) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">Lista no encontrada</p>
        <Button variant="outline" className="mt-3" onClick={() => router.push("/portal/lists")}>
          Volver
        </Button>
      </div>
    );
  }

  const total = items.reduce((a, i) => a + i.price * i.quantity, 0);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <button className="flex items-center gap-1 text-left" onClick={rename}>
          <h1 className="text-lg font-semibold">{list.name}</h1>
          <Pencil className="size-3.5 text-muted-foreground" />
        </button>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <PackagePlus className="size-4" /> Agregar
        </Button>
      </div>

      {list.notes && <p className="text-sm text-muted-foreground">{list.notes}</p>}

      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Agrega productos a tu lista
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((i) => (
              <SwipeableRow key={i.variantId} onDelete={() => removeItem(i.variantId)}>
              <div className="flex items-center justify-between gap-2 rounded-2xl border bg-card p-3.5 shadow-sm">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{i.productName}</p>
                  {i.variantName && <p className="text-xs text-muted-foreground">{i.variantName}</p>}
                  <p className="text-xs text-muted-foreground">{money(i.price)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="icon-xs" onClick={() => changeQty(i.variantId, -1)}>
                    <Minus className="size-3" />
                  </Button>
                  <span className="w-8 text-center text-sm tabular-nums">{round3(i.quantity)}</span>
                  <Button variant="outline" size="icon-xs" onClick={() => changeQty(i.variantId, 1)}>
                    <Plus className="size-3" />
                  </Button>
                  <Button variant="ghost" size="icon-xs" onClick={() => removeItem(i.variantId)} aria-label="Quitar">
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            </SwipeableRow>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total estimado</span>
            <span className="font-semibold">{money(total)}</span>
          </div>
        </div>
      )}

      <Button className="w-full" onClick={save} disabled={saving}>
        <Save className="size-4" /> {saving ? "Guardando…" : "Guardar lista"}
      </Button>

      <BottomSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Agregar productos"
        description="Busca un producto y elige su variante"
        bodyClassName="space-y-2"
      >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" className="pl-9 md:pl-9" placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="space-y-2">
            {searchResults.map((p) => (
              <div key={p.id} className="rounded-lg border p-2">
                <p className="text-sm font-medium">{p.name}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.variants.map((v) => {
                    const inList = items.some((i) => i.variantId === v.id);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        className={cn(
                          "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all active:scale-95",
                          inList ? "border-primary/40 bg-primary/10 text-primary" : "hover:bg-primary/10"
                        )}
                        onClick={() => {
                          addVariant(p.name, v.name === "Estándar" ? null : v.name, v.id, v.price);
                        }}
                      >
                        {inList ? <Check className="size-3" /> : <Plus className="size-3" />}
                        {v.name} · {money(v.price)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {searchResults.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">Sin resultados</p>
            )}
          </div>

          {items.length > 0 && (
            <Button className="w-full rounded-xl" onClick={() => setAddOpen(false)}>
              Listo ({items.length} producto{items.length !== 1 ? "s" : ""})
            </Button>
          )}
      </BottomSheet>
    </div>
  );
}
