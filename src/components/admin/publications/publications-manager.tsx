"use client";

import { useCallback, useEffect, useState } from "react";
import * as yup from "yup";
import { AlertCircle, FileText, Megaphone, Pencil, Plus, Trash2, Heading } from "lucide-react";
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
import { SwitchField } from "@/components/base/switch-field";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DialogComponent } from "@/components/ui/dialog";
import { useFocusInvalid } from "@/hooks/use-focus-invalid";

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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const { focusFirstEnabled, focusFirstInvalid } = useFocusInvalid();

  const load = useCallback(() => {
    publicationsApi
      .list()
      .then((d) => setItems(d.publications))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => { setErrors({}); setFormError(undefined); setForm({ ...EMPTY_FORM }); };

  const openEdit = (p: PublicationRow) => {
    setErrors({});
    setFormError(undefined);
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
  };

  const formIdentity = form ? form.id ?? "new" : null;
  useEffect(() => {
    if (!formIdentity) return;
    const frame = window.requestAnimationFrame(() => focusFirstEnabled("publication-form"));
    return () => window.cancelAnimationFrame(frame);
  }, [focusFirstEnabled, formIdentity]);

  const submit = async () => {
    if (!form) return;
    try {
      await yup.object({
        title: yup.string().trim().required("El título es obligatorio").max(160, "Máximo 160 caracteres"),
        content: yup.string().max(2000, "Máximo 2000 caracteres"),
      }).validate(form, { abortEarly: false });
      if (form.startsAt && form.endsAt && new Date(form.endsAt) < new Date(form.startsAt)) {
        throw new yup.ValidationError("La fecha de fin debe ser posterior al inicio", form.endsAt, "endsAt");
      }
      setErrors({});
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        const next: Record<string, string> = {};
        const failures = error.inner.length ? error.inner : [error];
        for (const failure of failures) if (failure.path && !next[failure.path]) next[failure.path] = failure.message;
        setErrors(next);
        const focusErrors = Object.fromEntries(Object.entries(next).map(([key, message]) => [`publication-${key}`, message]));
        window.requestAnimationFrame(() => focusFirstInvalid(focusErrors, "publication-form"));
      }
      return;
    }
    setSaving(true);
    setFormError(undefined);
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
      setFormError(err instanceof Error ? err.message : "No se pudo guardar la publicación");
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
        size="lg"
        className="sm:w-full"
        bodyClassName="space-y-3"
        footer={
          <>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="publication-form" disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </>
        }
      >
          {form && (
            <form id="publication-form" noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }} className="space-y-3">
              {formError && <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" />{formError}</div>}
              <InputGroupField
                id="publication-title"
                label="Título"
                leftIcon={<Heading className="size-4" />}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                error={errors.title}
              />
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5"><FileText className="size-4 text-muted-foreground" /><Label htmlFor="publication-content" className="cursor-pointer">Contenido</Label></div>
                <Textarea
                  id="publication-content"
                  rows={4}
                  value={form.content ?? ""}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  aria-invalid={Boolean(errors.content) || undefined}
                  aria-describedby={errors.content ? "publication-content-error" : undefined}
                  className={errors.content ? "border-destructive focus-visible:ring-destructive/20" : undefined}
                />
                {errors.content && <p id="publication-content-error" role="alert" className="text-xs text-destructive">{errors.content}</p>}
              </div>
              <FormCombobox
                id="publication-type"
                label="Tipo"
                value={form.type}
                onChange={(v) => setForm({ ...form, type: v as PublicationKind })}
                options={PUBLICATION_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                searchable={false}
                clearable={false}
              />
              <div className="grid grid-cols-2 gap-3">
                <DatePicker
                  id="publication-startsAt"
                  label="Fecha de inicio"
                  helper="Cuándo empieza a mostrarse."
                  value={form.startsAt ? new Date(form.startsAt) : null}
                  onChange={(d) => setForm({ ...form, startsAt: d ? d.toISOString() : null })}
                />
                <DatePicker
                  id="publication-endsAt"
                  label="Fecha de fin"
                  helper="Cuándo deja de mostrarse (opcional)."
                  value={form.endsAt ? new Date(form.endsAt) : null}
                  onChange={(d) => setForm({ ...form, endsAt: d ? d.toISOString() : null })}
                  error={errors.endsAt}
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
              <SwitchField id="publication-active" label="Activa" description="Visible en el portal" icon={<Megaphone className="size-4" />} checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            </form>
          )}
      </DialogComponent>
    </div>
  );
}
