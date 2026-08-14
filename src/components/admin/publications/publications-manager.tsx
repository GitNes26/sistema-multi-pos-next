"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { publicationsApi } from "@/lib/publications/client";
import {
  PUBLICATION_TYPES,
  PUBLICATION_TYPE_LABELS,
  type PublicationInput,
  type PublicationKind,
  type PublicationRow,
} from "@/lib/publications/server";
import { swalConfirm, swalError, swalToast } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const TYPE_COLORS: Record<string, string> = {
  product_new: "bg-emerald-500 text-white",
  promotion: "bg-amber-500 text-white",
  notice: "bg-sky-500 text-white",
};

const EMPTY_FORM: PublicationInput & { id?: string } = {
  id: undefined,
  title: "",
  content: "",
  imageUrl: "",
  type: "notice",
  isActive: true,
  publishedAt: null,
};

export function PublicationsManager() {
  const [items, setItems] = useState<PublicationRow[] | null>(null);
  const [form, setForm] = useState<(PublicationInput & { id?: string }) | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    publicationsApi
      .list()
      .then((d) => setItems(d.publications))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => setForm({ ...EMPTY_FORM });

  const openEdit = (p: PublicationRow) =>
    setForm({
      id: p.id,
      title: p.title,
      content: p.content ?? "",
      imageUrl: p.imageUrl ?? "",
      type: p.type as PublicationKind,
      isActive: p.isActive,
      publishedAt: p.publishedAt,
    });

  const submit = async () => {
    if (!form) return;
    if (!form.title?.trim()) {
      swalError("El título es obligatorio");
      return;
    }
    setSaving(true);
    try {
      if (form.id) {
        await publicationsApi.update(form.id, form);
        swalToast("Publicación actualizada");
      } else {
        await publicationsApi.create(form);
        swalToast("Publicación creada");
      }
      setForm(null);
      load();
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p: PublicationRow) => {
    const ok = await swalConfirm("Eliminar publicación", `¿Eliminar "${p.title}"?`, { danger: true });
    if (!ok) return;
    try {
      await publicationsApi.remove(p.id);
      load();
      swalToast("Publicación eliminada", "info");
    } catch (err) {
      swalError("No se pudo eliminar", err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="size-4" /> Nueva publicación
        </Button>
      </div>

      {!items ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No hay publicaciones</p>
      ) : (
        <div className="space-y-2">
          {items.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border p-3">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt={p.title} className="size-12 shrink-0 rounded-md object-cover" />
              ) : (
                <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Megaphone className="size-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{p.title}</p>
                  <Badge className={TYPE_COLORS[p.type] ?? "bg-secondary"}>
                    {PUBLICATION_TYPE_LABELS[p.type as PublicationKind] ?? p.type}
                  </Badge>
                  {!p.isActive && <Badge variant="outline">Inactiva</Badge>}
                </div>
                {p.content && <p className="truncate text-xs text-muted-foreground">{p.content}</p>}
              </div>
              <Button variant="ghost" size="icon-xs" onClick={() => openEdit(p)} aria-label="Editar">
                <Pencil className="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon-xs" onClick={() => remove(p)} aria-label="Eliminar">
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={form !== null} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar publicación" : "Nueva publicación"}</DialogTitle>
            <DialogDescription>Se mostrará a los clientes en el portal</DialogDescription>
          </DialogHeader>

          {form && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Título</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Contenido</Label>
                <Textarea
                  value={form.content ?? ""}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Imagen URL</Label>
                  <Input
                    value={form.imageUrl ?? ""}
                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <select
                    className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as PublicationKind })}
                  >
                    {PUBLICATION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-2.5">
                <div>
                  <p className="text-sm font-medium">Activa</p>
                  <p className="text-xs text-muted-foreground">Visible en el portal</p>
                </div>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
