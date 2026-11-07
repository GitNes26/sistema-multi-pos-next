"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, ClipboardCheck, Loader2, Minus } from "lucide-react";
import { toast } from "sonner";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Attachment } from "@/components/base/attachment";
import { InputGroupField } from "@/components/base/input-group-field";
import { TextareaField } from "@/components/base/textarea-field";
import { uploadFile, UPLOAD_IMAGE_ACCEPT } from "@/lib/uploads";
import { cn } from "@/lib/utils";

export interface ChecklistTemplate {
  id: string;
  phase: string;
  name: string;
  isRequired: boolean;
  items: { id: string; label: string; requirePhoto: boolean }[];
}
export interface ChecklistRun {
  id: string;
  phase: string;
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
  items: { label: string; status: string; note: string | null; photoUrl: string | null }[];
}

type Status = "ok" | "issue" | "na";
interface Row {
  label: string;
  requirePhoto: boolean;
  status: Status | "";
  note: string;
  photoUrl: string | null;
}

const STATUS_BUTTONS: { value: Status; label: string; icon: typeof Check; on: string }[] = [
  { value: "ok", label: "Bien", icon: Check, on: "border-success bg-success/15 text-success-ink" },
  { value: "issue", label: "Problema", icon: AlertTriangle, on: "border-destructive bg-destructive/10 text-destructive" },
  { value: "na", label: "No aplica", icon: Minus, on: "border-foreground/40 bg-muted" },
];

/** Hacer (o consultar) la revisión de una fase: cada punto en Bien, Problema o No aplica, con nota y foto del problema. */
export function ChecklistRunDialog({
  open,
  onOpenChange,
  orderId,
  template,
  lastRun,
  canManage,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  template: ChecklistTemplate | null;
  lastRun: ChecklistRun | null;
  canManage: boolean;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !template) return;
    setError(null);
    setNotes("");
    setRows(template.items.map((i) => ({ label: i.label, requirePhoto: i.requirePhoto, status: "", note: "", photoUrl: null })));
  }, [open, template]);

  if (!template) return null;
  const set = (i: number, patch: Partial<Row>) => setRows((prev) => prev.map((r, at) => (at === i ? { ...r, ...patch } : r)));
  const pending = rows.filter((r) => !r.status).length;

  const save = async () => {
    setError(null);
    const missing = rows.find((r) => !r.status);
    if (missing) return setError(`Falta revisar: ${missing.label}`);
    const noPhoto = rows.find((r) => r.status === "issue" && r.requirePhoto && !r.photoUrl);
    if (noPhoto) return setError(`Agrega una foto del problema: ${noPhoto.label}`);
    setSaving(true);
    try {
      const res = await fetch(`/api/service-orders/${orderId}/checklists`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: template.phase, notes, items: rows.map((r) => ({ label: r.label, status: r.status, note: r.note, photoUrl: r.photoUrl })) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo guardar la revisión");
      toast.success(data.issues ? `Revisión guardada: ${data.issues} ${data.issues === 1 ? "problema" : "problemas"}` : "Revisión guardada");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la revisión");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogComponent
      open={open}
      onOpenChange={onOpenChange}
      icon={<ClipboardCheck className="size-5 text-primary" />}
      title={template.name}
      description={template.isRequired ? "Es obligatoria: sin ella no se avanza o no se cobra." : "Marca el estado de cada punto."}
      className="sm:max-w-xl"
      footer={
        <>
          {error && <p className="mr-auto text-sm font-medium text-destructive">{error}</p>}
          {!error && canManage && <span className="mr-auto text-sm text-muted-foreground">{pending ? `${pending} por revisar` : "Todo revisado"}</span>}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          {canManage && (
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Guardar revisión
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {lastRun && (
          <p className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
            Ya hay una revisión del {new Date(lastRun.createdAt).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            {lastRun.createdBy ? ` por ${lastRun.createdBy}` : ""}: {lastRun.items.filter((i) => i.status === "issue").length} problema(s). Guardar una nueva la reemplaza como vigente; la anterior se conserva en el historial.
          </p>
        )}
        {lastRun && lastRun.items.some((i) => i.status === "issue") && (
          <ul className="space-y-2">
            {lastRun.items
              .filter((i) => i.status === "issue")
              .map((i) => (
                <li key={i.label} className="flex items-start gap-3 rounded-xl border border-destructive/30 p-2 text-sm">
                  {i.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.photoUrl} alt={`Foto: ${i.label}`} className="size-14 shrink-0 rounded-lg object-cover" />
                  )}
                  <span>
                    <span className="block font-medium">{i.label}</span>
                    {i.note && <span className="block text-xs text-muted-foreground">{i.note}</span>}
                  </span>
                </li>
              ))}
          </ul>
        )}

        {canManage && (
          <ol className="space-y-3">
            {rows.map((r, i) => (
              <li key={r.label} className="space-y-2 rounded-xl border p-3">
                <p className="text-sm font-medium">{r.label}</p>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={r.label}>
                  {STATUS_BUTTONS.map((b) => (
                    <button
                      key={b.value}
                      type="button"
                      role="radio"
                      aria-checked={r.status === b.value}
                      onClick={() => set(i, { status: b.value })}
                      className={cn("press inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm", r.status === b.value ? b.on : "text-muted-foreground hover:bg-muted/50")}
                    >
                      <b.icon className="size-3.5" /> {b.label}
                    </button>
                  ))}
                </div>
                {r.status === "issue" && (
                  <div className="space-y-2">
                    <InputGroupField label="Detalle" value={r.note} onChange={(e) => set(i, { note: e.target.value })} placeholder="Ej. rayón de 10 cm en la puerta derecha" maxLength={300} />
                    <Attachment label="Foto del problema" required={r.requirePhoto} value={r.photoUrl} onChange={(url) => set(i, { photoUrl: url })} upload={uploadFile} accept={UPLOAD_IMAGE_ACCEPT} widthClass="w-32" heightClass="h-24" cropAspect={4 / 3} />
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
        {canManage && <TextareaField label="Notas de la revisión" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej. el cliente estuvo presente y está de acuerdo" rows={2} />}
      </div>
    </DialogComponent>
  );
}
