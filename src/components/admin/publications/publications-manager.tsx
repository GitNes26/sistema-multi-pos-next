"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone, Pencil, Plus, Trash2, Heading } from "lucide-react";
import { publicationsApi } from "@/lib/publications/client";
import {
  PUBLICATION_TYPES,
  PUBLICATION_TYPE_LABELS,
  type PublicationInput,
  type PublicationKind,
  type PublicationRow,
} from "@/lib/publications/server";
import { uploadFile, UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads";
import { swalConfirm, swalError, swalToast } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormCombobox } from "@/components/base/form-combobox";
import { InputGroupField } from "@/components/base/input-group-field";
import { Attachment } from "@/components/base/attachment";
import { DatePicker } from "@/components/base/date-picker";
import { TooltipButton } from "@/components/shared/tooltip-button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DialogComponent } from "@/components/ui/dialog";

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
  startsAt: null,
  endsAt: null,
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
      startsAt: p.startsAt,
      endsAt: p.endsAt,
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
              <TooltipButton label="Editar" variant="ghost" size="icon-xs" onClick={() => openEdit(p)}>
                <Pencil className="size-3.5" />
              </TooltipButton>
              <TooltipButton label="Eliminar" variant="ghost" size="icon-xs" onClick={() => remove(p)}>
                <Trash2 className="size-3.5 text-destructive" />
              </TooltipButton>
            </div>
          ))}
        </div>
      )}

      <DialogComponent
        open={form !== null}
        onOpenChange={(o) => !o && setForm(null)}
        icon={<Megaphone className="size-4 text-primary" />}
        title={form?.id ? "Editar publicación" : "Nueva publicación"}
        description="Se mostrará a los clientes en el portal"
        className="sm:max-w-md"
        bodyClassName="space-y-3"
        footer={
          <>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </>
        }
      >
          {form && (
            <div className="space-y-3">
              <InputGroupField
                label="Título"
                leftIcon={<Heading className="size-4" />}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <div className="space-y-1.5">
                <Label>Contenido</Label>
                <Textarea
                  value={form.content ?? ""}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                />
              </div>
              <FormCombobox
                label="Tipo"
                value={form.type}
                onChange={(v) => setForm({ ...form, type: v as PublicationKind })}
                options={PUBLICATION_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                searchable={false}
                clearable={false}
              />
              <div className="grid grid-cols-2 gap-3">
                <DatePicker
                  label="Fecha de inicio"
                  helper="Cuándo empieza a mostrarse."
                  value={form.startsAt ? new Date(form.startsAt) : null}
                  onChange={(d) => setForm({ ...form, startsAt: d ? d.toISOString() : null })}
                />
                <DatePicker
                  label="Fecha de fin"
                  helper="Cuándo deja de mostrarse (opcional)."
                  value={form.endsAt ? new Date(form.endsAt) : null}
                  onChange={(d) => setForm({ ...form, endsAt: d ? d.toISOString() : null })}
                />
              </div>
              <Attachment
                label="Imagen"
                helper="Banner de la publicación."
                value={form.imageUrl ?? ""}
                onChange={(url) => setForm({ ...form, imageUrl: url ?? "" })}
                upload={uploadFile}
                accept={UPLOAD_IMAGE_ACCEPT}
              />
              <div className="flex items-center justify-between rounded-lg border p-2.5">
                <label htmlFor="pub-active" className="cursor-pointer">
                  <span className="block text-sm font-medium">Activa</span>
                  <span className="block text-xs text-muted-foreground">Visible en el portal</span>
                </label>
                <Switch
                  id="pub-active"
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                />
              </div>
            </div>
          )}
      </DialogComponent>
    </div>
  );
}
