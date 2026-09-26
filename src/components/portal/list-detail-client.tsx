"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Minus, Plus, Save, Search, Trash2, Pencil, PackagePlus, Check, ListChecks } from "lucide-react";
import { portalApi } from "@/lib/portal/client";
import type { ShoppingListView } from "@/lib/portal/server";
import { money, round3 } from "@/lib/pos/money";
import { usePortalStore } from "@/stores/portal-store";
import { swalToast } from "@/lib/swal";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BottomSheet } from "@/components/portal/bottom-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { SwipeableRow } from "@/components/shared/swipeable-row";
import { PullToRefresh } from "@/components/shared/pull-to-refresh";
import { STAGGER_FADE_UP } from "@/lib/animation-tokens";
import { DialogComponent } from "@/components/ui/dialog";
import { InputGroupField } from "@/components/base/input-group-field";
import { Textarea } from "@/components/ui/textarea";

interface DraftItem {
  id?: string;
  variantId: string | null;
  productId: string;
  unitId: string | null;
  unitAbbrev: string | null;
  step: number;
  productName: string;
  variantName: string | null;
  price: number;
  quantity: number;
}

const itemKey = (i: Pick<DraftItem, "variantId" | "productId" | "unitId">) =>
  i.variantId ? `v:${i.variantId}` : `b:${i.productId}:${i.unitId}`;

export function ListDetailClient({ listId }: { listId: string }) {
  const router = useRouter();
  const [list, setList] = useState<ShoppingListView | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

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
            productId: i.productId,
            unitId: i.unitId,
            unitAbbrev: i.unitAbbrev,
            step: i.step,
            productName: i.productName,
            variantName: i.variantName,
            price: i.price,
            quantity: i.quantity,
          }))
        );
        setStorefront(store.categories, store.products);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "No se pudo cargar la lista");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [listId, setStorefront]);

  const availableProducts = useMemo(
    () => products.filter((p) => p.isAvailable && (p.kind === "bulk" ? Boolean(p.bulk?.unitId) : p.variants.length > 0)),
    [products]
  );

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableProducts;
    return availableProducts.filter((p) => p.name.toLowerCase().includes(q));
  }, [availableProducts, search]);

  const editDetails = () => {
    if (!list) return;
    setDraftName(list.name);
    setDraftNotes(list.notes ?? "");
    setNameError(null);
    setMetaOpen(true);
    requestAnimationFrame(() => nameRef.current?.focus());
  };

  const addItem = (item: DraftItem) => {
    setDirty(true);
    setItems((prev) => {
      const key = itemKey(item);
      const existing = prev.find((i) => itemKey(i) === key);
      if (existing) {
        return prev.map((i) => (itemKey(i) === key ? { ...i, quantity: round3(i.quantity + item.step) } : i));
      }
      return [...prev, item];
    });
  };

  const changeQty = (key: string, delta: number) => {
    setDirty(true);
    setItems((prev) =>
      prev.map((i) => (itemKey(i) === key ? { ...i, quantity: Math.max(i.step, round3(i.quantity + delta)) } : i))
    );
  };

  const removeItem = (key: string) => {
    setDirty(true);
    setItems((prev) => prev.filter((i) => itemKey(i) !== key));
  };

  const save = async (nextName?: string, nextNotes?: string | null) => {
    if (!list) return false;
    const name = (nextName ?? list.name).trim();
    if (!name) { setNameError("Escribe un nombre para la lista"); nameRef.current?.focus(); return false; }
    setSaving(true);
    setError(null);
    try {
      const res = await portalApi.updateList(listId, {
        name,
        notes: nextNotes === undefined ? list.notes : nextNotes,
        items: items.map((i) => ({ variantId: i.variantId, productId: i.variantId ? null : i.productId, unitId: i.unitId, quantity: i.quantity })),
      });
      setList(res.list);
      setItems(
        res.list.items.map((i) => ({
          id: i.id,
          variantId: i.variantId,
          productId: i.productId,
          unitId: i.unitId,
          unitAbbrev: i.unitAbbrev,
          step: i.step,
          productName: i.productName,
          variantName: i.variantName,
          price: i.price,
          quantity: i.quantity,
        }))
      );
      setDirty(false);
      swalToast("Lista guardada");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la lista");
      return false;
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
    <PullToRefresh onRefresh={() => {}}>
      <motion.div
        className="space-y-4 p-4"
        variants={STAGGER_FADE_UP.container}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={STAGGER_FADE_UP.item} className="flex items-start justify-between gap-3">
          <div className="min-w-0"><h1 className="break-words text-xl font-bold">{list.name}</h1><p className="text-sm text-muted-foreground">{items.length} producto{items.length === 1 ? "" : "s"} · Lista de compras</p><button type="button" className="mt-1 flex min-h-11 items-center gap-1 text-sm font-medium text-primary" onClick={editDetails}><Pencil className="size-4" /> Editar nombre y notas</button></div>
          <Button className="h-11 shrink-0" onClick={() => setAddOpen(true)}>
            <PackagePlus className="size-4" /> Agregar
          </Button>
        </motion.div>

        {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

        {list.notes && <motion.p variants={STAGGER_FADE_UP.item} className="text-sm text-muted-foreground">{list.notes}</motion.p>}

        <motion.div variants={STAGGER_FADE_UP.item}>
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Agrega productos a tu lista
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((i) => (
                <SwipeableRow key={itemKey(i)} onDelete={() => removeItem(itemKey(i))}>
                <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{i.productName}</p>
                    {i.variantName && i.variantName !== "Default" && <p className="text-xs text-muted-foreground">{i.variantName}</p>}
                    <p className="text-xs text-muted-foreground">{money(i.price)}{i.unitAbbrev ? `/${i.unitAbbrev}` : " c/u"} · {money(i.price * i.quantity)} estimado</p>
                  </div>
                  <div className="flex items-center justify-between gap-1.5 sm:justify-end">
                    <Button variant="outline" size="icon" className="size-11" disabled={i.quantity <= i.step} aria-label={`Reducir ${i.productName}`} onClick={() => changeQty(itemKey(i), -i.step)}>
                      <Minus className="size-4" />
                    </Button>
                    <span className="min-w-16 text-center text-sm font-semibold tabular-nums">{round3(i.quantity)}{i.unitAbbrev ? ` ${i.unitAbbrev}` : ""}</span>
                    <Button variant="outline" size="icon" className="size-11" aria-label={`Aumentar ${i.productName}`} onClick={() => changeQty(itemKey(i), i.step)}>
                      <Plus className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-11" onClick={() => removeItem(itemKey(i))} aria-label={`Quitar ${i.productName}`}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </SwipeableRow>
            ))}
          </div>
        )}
        </motion.div>

        {items.length > 0 && (
          <motion.div variants={STAGGER_FADE_UP.item} className="rounded-2xl border bg-card p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total estimado</span>
              <span className="font-semibold">{money(total)}</span>
            </div>
          </motion.div>
        )}

        <motion.div variants={STAGGER_FADE_UP.item} className="sticky bottom-20 z-20 rounded-2xl border bg-background/95 p-2 shadow-lg backdrop-blur">
          <Button className="h-12 w-full" onClick={() => void save()} disabled={saving || !dirty}>
            <Save className="size-4" /> {saving ? "Guardando…" : "Guardar lista"}
          </Button>
        </motion.div>

        <BottomSheet
          open={addOpen}
          onOpenChange={setAddOpen}
          title="Agregar productos"
          description="Busca un producto y elige una variante o unidad de venta"
          bodyClassName="space-y-2"
        >
            <div className="sticky top-0 z-10 bg-background pb-2"><div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" className="pl-9 md:pl-9 desk:pl-9" aria-label="Buscar productos para la lista" placeholder="Buscar productos…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div></div>
            <div className="space-y-2">
              {searchResults.map((p) => (
                <div key={p.id} className="rounded-xl border p-3">
                  <p className="text-sm font-semibold">{p.name}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {p.bulk && ([{ unitId: p.bulk.unitId, unitName: p.bulk.unitName, unitAbbrev: p.bulk.unitAbbrev, price: p.bulk.price, step: p.bulk.step || 0.01, quantity: Math.max(p.bulk.minQty, p.bulk.step || 0.01) }, ...(p.bulk.split ? [{ ...p.bulk.split, step: 1, quantity: 1 }] : [])]).map((unit) => {
                      const selected = items.some((i) => !i.variantId && i.productId === p.productId && i.unitId === unit.unitId);
                      return <button key={unit.unitId} type="button" className={cn("min-h-11 rounded-md border px-3 py-2 text-xs font-medium", selected ? "border-primary bg-primary/10 text-primary" : "hover:bg-primary/10")} onClick={() => addItem({ productId: p.productId, variantId: null, unitId: unit.unitId, unitAbbrev: unit.unitAbbrev, step: unit.step, productName: p.name, variantName: unit.unitName, price: unit.price, quantity: unit.quantity })}>{selected ? <Check className="mr-1 inline size-3" /> : <Plus className="mr-1 inline size-3" />}{unit.unitName} · {money(unit.price)}/{unit.unitAbbrev}</button>;
                    })}
                    {p.variants.map((v) => {
                      const inList = items.some((i) => i.variantId === v.id);
                      return (
                        <button
                          key={v.id}
                          type="button"
                          className={cn(
                            "flex min-h-11 items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-all active:scale-95",
                            inList ? "border-primary/40 bg-primary/10 text-primary" : "hover:bg-primary/10"
                          )}
                          onClick={() => {
                            addItem({ productId: p.productId, variantId: v.id, unitId: null, unitAbbrev: null, step: 1, productName: p.name, variantName: v.name === "Estándar" ? null : v.name, price: v.price, quantity: 1 });
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
        <DialogComponent open={metaOpen} onOpenChange={setMetaOpen} title="Editar lista" description="Cambia el nombre o añade una nota para reconocerla." icon={<Pencil className="size-5" />} size="sm" footer={<><Button variant="outline" type="button" onClick={() => setMetaOpen(false)}>Cancelar</Button><Button type="submit" form="list-details-form" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</Button></>}>
          <form id="list-details-form" className="space-y-4 py-2" onSubmit={async (event) => { event.preventDefault(); const done = await save(draftName, draftNotes.trim() || null); if (done) setMetaOpen(false); }} noValidate>
            <InputGroupField ref={nameRef} label="Nombre de la lista" id="list-details-name" required leftIcon={<ListChecks className="size-4" />} value={draftName} error={nameError ?? undefined} onChange={(event) => { setDraftName(event.target.value); setNameError(null); }} />
            <div className="space-y-2"><label htmlFor="list-details-notes" className="flex items-center gap-2 text-sm font-medium"><Pencil className="size-4 text-muted-foreground" /> Notas (opcional)</label><Textarea id="list-details-notes" rows={3} maxLength={300} value={draftNotes} onChange={(event) => setDraftNotes(event.target.value)} /></div>
          </form>
        </DialogComponent>
      </motion.div>
    </PullToRefresh>
  );
}
