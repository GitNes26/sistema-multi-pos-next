"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { TemplateStatus } from "@/lib/templates/server";
import { swalConfirm, swalError, swalToast } from "@/lib/swal";

type View = Omit<TemplateStatus, never>;

/** Plantillas de arranque: un clic deja listo lo básico de un autolavado, barbería o renta (sin duplicar lo existente). */
export function TemplatesClient() {
  const [templates, setTemplates] = useState<View[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ key: string; created: string[]; existing: string[] } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/templates", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "No se pudieron cargar las plantillas");
      setTemplates(json.templates);
    } catch (err) {
      setTemplates((prev) => prev ?? []);
      swalError("No se pudieron cargar las plantillas", err instanceof Error ? err.message : undefined);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = async (t: View) => {
    if (!(await swalConfirm(`¿Aplicar «${t.label}»?`, "Solo se crea lo que falte: no se duplica ni se cambia nada de lo que ya tienes.", { confirmText: "Aplicar", cancelText: "Cancelar" }))) return;
    setBusy(t.key);
    try {
      const res = await fetch("/api/settings/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: t.key }) });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "No se pudo aplicar");
      setResult({ key: t.key, created: json.created, existing: json.existing });
      swalToast(json.created.length ? "Plantilla aplicada" : "Todo ya estaba creado");
      void load();
    } catch (err) {
      swalError("No se pudo aplicar", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  if (templates === null) return <Skeleton className="h-40 rounded-2xl" />;

  return (
    <div data-guide="templates-list" className="grid gap-3 md:grid-cols-3">
      {templates.map((t) => (
        <article key={t.key} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-heading text-lg font-semibold">{t.label}</h3>
            {t.applied && <Badge variant="secondary"><Check className="mr-1 size-3" /> Aplicada</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{t.description}</p>
          <ul className="flex-1 space-y-1 text-sm">
            {t.highlights.map((h) => (
              <li key={h} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-primary" />{h}</li>
            ))}
          </ul>
          {result?.key === t.key && (
            <div className="rounded-xl bg-muted/50 p-2.5 text-xs">
              {result.created.length > 0 && <p className="font-medium">Creado: {result.created.join(" · ")}</p>}
              {result.existing.length > 0 && <p className="mt-1 text-muted-foreground">Ya existía: {result.existing.join(" · ")}</p>}
            </div>
          )}
          {t.available ? (
            <Button onClick={() => void apply(t)} disabled={busy !== null}>
              {busy === t.key ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
              {t.applied ? "Completar lo que falte" : "Aplicar plantilla"}
            </Button>
          ) : (
            <p className="rounded-xl border border-dashed p-2.5 text-xs text-muted-foreground">No aplica al tipo de negocio de tu empresa.</p>
          )}
        </article>
      ))}
    </div>
  );
}
