"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Save, Pencil, PackagePlus, ListChecks } from "lucide-react";
import { QtyControl } from "@/components/portal/qty-control";
import { itemKey, toDraft, toPayload, type DraftItem } from "@/components/portal/list-draft";
import { portalApi } from "@/lib/portal/client";
import type { ShoppingListView } from "@/lib/portal/server";
import { money, round3 } from "@/lib/pos/money";
import { swalToast } from "@/lib/swal";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SwipeableRow } from "@/components/shared/swipeable-row";
import { PullToRefresh } from "@/components/shared/pull-to-refresh";
import { STAGGER_FADE_UP } from "@/lib/animation-tokens";
import { DialogComponent } from "@/components/ui/dialog";
import { InputGroupField } from "@/components/base/input-group-field";
import { Textarea } from "@/components/ui/textarea";

export function ListDetailClient({ listId }: { listId: string }) {
  const router = useRouter();
  const [list, setList] = useState<ShoppingListView | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  useEffect(() => {
    let active = true;
    portalApi
      .list(listId)
      .then((d) => {
        if (!active) return;
        setList(d.list);
        setItems(d.list.items.map(toDraft));
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "No se pudo cargar la lista");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [listId]);

  const editDetails = () => {
    if (!list) return;
    setDraftName(list.name);
    setDraftNotes(list.notes ?? "");
    setNameError(null);
    setMetaOpen(true);
    requestAnimationFrame(() => nameRef.current?.focus());
  };

  const setQty = (key: string, quantity: number) => {
    setDirty(true);
    setItems((prev) => prev.map((i) => (itemKey(i) === key ? { ...i, quantity } : i)));
  };

  /** «Agregar» abre la tienda en modo lista; antes se guarda lo pendiente. */
  const openStore = async () => {
    if (dirty && !(await save())) return;
    router.push(`/portal/store?list=${listId}`);
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
        items: toPayload(items),
      });
      setList(res.list);
      setItems(res.list.items.map(toDraft));
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
          <Button className="h-11 shrink-0" onClick={() => void openStore()}>
            <PackagePlus className="size-4" /> Agregar
          </Button>
        </motion.div>

        {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}

        {list.notes && <motion.p variants={STAGGER_FADE_UP.item} className="text-sm text-muted-foreground">{list.notes}</motion.p>}

        <motion.div variants={STAGGER_FADE_UP.item}>
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">Tu lista está vacía.</p>
            <Button className="h-12" onClick={() => void openStore()}><PackagePlus className="size-4" /> Elegir productos en la tienda</Button>
          </div>
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
                    <QtyControl value={i.quantity} step={i.step} unit={i.unitAbbrev} label={i.productName} onChange={(q) => setQty(itemKey(i), q)} onRemove={() => removeItem(itemKey(i))} />
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
