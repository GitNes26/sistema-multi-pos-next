"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus, Trash2, ListChecks } from "lucide-react";
import { portalApi } from "@/lib/portal/client";
import type { ShoppingListRow } from "@/lib/portal/server";
import { swalConfirm, swalError, swalPrompt, swalToast } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PullToRefresh } from "@/components/shared/pull-to-refresh";
import { EmptyState } from "@/components/shared/empty-state";

export function ListsClient() {
  const router = useRouter();
  const [lists, setLists] = useState<ShoppingListRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    portalApi
      .lists()
      .then((d) => setLists(d.lists))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    const name = await swalPrompt("Nueva lista", "Nombre de la lista…", undefined, "Ej. Despensa semanal");
    if (!name) return;
    try {
      const res = await portalApi.createList({ name, notes: null, items: [] });
      swalToast("Lista creada");
      router.push(`/portal/lists/${res.list.id}`);
    } catch (err) {
      swalError("No se pudo crear", err instanceof Error ? err.message : undefined);
    }
  };

  const duplicate = async (id: string) => {
    try {
      const res = await portalApi.duplicateList(id);
      swalToast("Lista duplicada");
      setLists((prev) =>
        prev ? [{ id: res.list.id, name: res.list.name, notes: res.list.notes, itemsCount: res.list.items.length, createdAt: res.list.createdAt }, ...prev] : prev
      );
    } catch (err) {
      swalError("No se pudo duplicar", err instanceof Error ? err.message : undefined);
    }
  };

  const remove = async (id: string) => {
    const ok = await swalConfirm("Eliminar lista", "¿Seguro que quieres eliminar esta lista?", { danger: true });
    if (!ok) return;
    try {
      await portalApi.deleteList(id);
      setLists((prev) => (prev ? prev.filter((l) => l.id !== id) : prev));
      swalToast("Lista eliminada", "info");
    } catch (err) {
      swalError("No se pudo eliminar", err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <PullToRefresh onRefresh={load}>
      <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Listas de compra</h1>
        <Button size="sm" onClick={create}>
          <Plus className="size-4" /> Nueva
        </Button>
      </div>

      {error && <p className="text-sm text-muted-foreground">{error}</p>}

      {!lists ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : lists.length === 0 ? (
        <EmptyState icon={ListChecks} title="No tienes listas todavía" description="Crea una lista para organizar tu compra." />
      ) : (
        lists.map((l) => (
          <div
            key={l.id}
            className="flex items-center justify-between rounded-xl border p-3"
          >
            <button
              className="min-w-0 flex-1 text-left"
              onClick={() => router.push(`/portal/lists/${l.id}`)}
            >
              <p className="truncate text-sm font-medium">{l.name}</p>
              <p className="text-xs text-muted-foreground">
                {l.itemsCount} producto{l.itemsCount !== 1 ? "s" : ""}
              </p>
            </button>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-xs" onClick={() => duplicate(l.id)} aria-label="Duplicar">
                <Copy className="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon-xs" onClick={() => remove(l.id)} aria-label="Eliminar">
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
          </div>
        ))
      )}
      </div>
    </PullToRefresh>
  );
}
