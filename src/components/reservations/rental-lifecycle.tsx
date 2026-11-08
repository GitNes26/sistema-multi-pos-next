"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ClipboardCheck, Clock, Loader2, PackageCheck, PackageOpen, Printer, ShieldCheck, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputGroupField } from "@/components/base/input-group-field";
import {
  ChecklistRunDialog,
  type ChecklistRun,
  type ChecklistTemplate,
} from "@/components/admin/service-orders/checklist-run-dialog";
import { cn } from "@/lib/utils";
import { fmtMoney, type ReservationView } from "./reservation-types";

const when = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * Depósito, entrega y devolución de una renta. Las revisiones usan el mismo motor que las órdenes de
 * servicio (con fotos de los problemas) y, si son obligatorias, el servidor no deja entregar o recibir sin ellas.
 */
export function RentalLifecycle({
  reservation,
  canManage,
  onChanged,
}: {
  reservation: ReservationView;
  canManage: boolean;
  onChanged: () => void;
}) {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [runs, setRuns] = useState<Record<string, ChecklistRun>>({});
  const [runPhase, setRunPhase] = useState<"delivery" | "return" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [damageFee, setDamageFee] = useState("");
  const [penaltyNotes, setPenaltyNotes] = useState("");

  const loadChecklists = useCallback(async () => {
    try {
      const res = await fetch(`/api/reservaciones/${reservation.id}/checklists`, { cache: "no-store", credentials: "include" });
      const data = await res.json();
      if (data.ok) {
        setTemplates(data.templates ?? []);
        setRuns(data.runs ?? {});
      }
    } catch {
      /* sin listas: se puede entregar/recibir si no son obligatorias */
    }
  }, [reservation.id]);

  useEffect(() => {
    setError(null);
    setDamageFee("");
    setPenaltyNotes("");
    void loadChecklists();
  }, [reservation.id, loadChecklists]);

  if (reservation.status === "cancelled") return null;
  const delivered = Boolean(reservation.deliveredAt);
  const returned = Boolean(reservation.returnedAt);
  const canDeliver = canManage && !delivered && (reservation.status === "confirmed" || reservation.status === "completed");
  const canReturn = canManage && delivered && !returned;
  const hasDeposit = reservation.depositAmount > 0;
  if (!hasDeposit && !delivered && !canDeliver) return null;

  const template = (phase: "delivery" | "return") => templates.find((t) => t.phase === phase) ?? null;

  const post = async (path: "deliver" | "return" | "settle", body?: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservaciones/${reservation.id}/${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo completar");
      if (path === "settle") {
        if (data.cashPending) setError("Abre la caja para registrar el efectivo del depósito");
        else toast.success("Efectivo registrado en la caja");
      } else {
        toast.success(path === "deliver" ? "Equipo entregado (depósito en caja)" : "Equipo recibido");
        if (data.cashPending) toast.warning("Abre la caja y registra el efectivo del depósito");
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar");
    } finally {
      setBusy(false);
    }
  };

  const checklistButton = (phase: "delivery" | "return", label: string) => {
    const t = template(phase);
    if (!t) return null;
    const done = Boolean(runs[phase]);
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setRunPhase(phase)}>
        <ClipboardCheck className="size-4" /> {label}
        {done ? <Check className="size-4 text-success-ink" /> : t.isRequired ? <span className="text-xs text-destructive">obligatoria</span> : null}
      </Button>
    );
  };

  return (
    <div className="space-y-3 rounded-xl border p-3" data-guide="rental-lifecycle">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <ShieldCheck className="size-4 text-primary" /> Depósito y entrega
        </p>
        <div className="flex items-center gap-2">
          {hasDeposit && <span className="text-sm font-bold">{fmtMoney(reservation.depositAmount)}</span>}
          <Button type="button" size="sm" variant="outline" onClick={() => window.open(`/api/reservaciones/${reservation.id}/hoja`, "_blank", "noopener")}>
            <Printer className="size-4" /> Hoja
          </Button>
        </div>
      </div>
      {hasDeposit && (
        <p className="text-xs text-muted-foreground">
          El depósito se retiene hasta la devolución, no es ingreso y se usa para cubrir retrasos y daños.
        </p>
      )}

      <ul className="space-y-1 text-sm">
        <li className="flex items-center gap-2">
          <PackageOpen className={cn("size-4", delivered ? "text-success-ink" : "text-muted-foreground")} />
          {delivered ? `Entregado ${when(reservation.deliveredAt!)}` : "Pendiente de entrega"}
        </li>
        <li className="flex items-center gap-2">
          <PackageCheck className={cn("size-4", returned ? "text-success-ink" : "text-muted-foreground")} />
          {returned ? `Recibido ${when(reservation.returnedAt!)}` : "Pendiente de devolución"}
        </li>
      </ul>

      {canDeliver && (
        <div className="flex flex-wrap items-center gap-2">
          {checklistButton("delivery", "Revisión de entrega")}
          <Button type="button" size="sm" onClick={() => void post("deliver")} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <PackageOpen className="size-4" />} Entregar equipo
          </Button>
        </div>
      )}

      {canReturn && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">{checklistButton("return", "Revisión de devolución")}</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <InputGroupField label="Cargo por daños" type="number" min="0" step="0.01" value={damageFee} onChange={(e) => setDamageFee(e.target.value)} placeholder="0.00" />
            <InputGroupField label="Detalle del cargo" value={penaltyNotes} onChange={(e) => setPenaltyNotes(e.target.value)} placeholder="Ej. rasgadura en la lona" maxLength={190} />
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" /> El retraso se calcula solo con la política de rentas.
          </p>
          <Button type="button" size="sm" onClick={() => void post("return", { damageFee: damageFee === "" ? 0 : Number(damageFee), penaltyNotes })} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Undo2 className="size-4" />} Recibir equipo
          </Button>
        </div>
      )}

      {returned && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-lg bg-muted/40 p-2 text-sm">
          <dt className="text-muted-foreground">Retraso</dt>
          <dd className="text-right font-medium tabular-nums">{fmtMoney(reservation.lateFee)}</dd>
          <dt className="text-muted-foreground">Daños</dt>
          <dd className="text-right font-medium tabular-nums">{fmtMoney(reservation.damageFee)}</dd>
          <dt className="font-semibold">Regresar al cliente</dt>
          <dd className="text-right font-bold tabular-nums">{fmtMoney(reservation.depositRefund ?? 0)}</dd>
          {(reservation.balanceDue ?? 0) > 0 && (
            <>
              <dt className="font-semibold text-destructive">Saldo por cobrar</dt>
              <dd className="text-right font-bold tabular-nums text-destructive">{fmtMoney(reservation.balanceDue ?? 0)}</dd>
            </>
          )}
          {reservation.penaltyNotes && <dd className="col-span-2 text-xs text-muted-foreground">{reservation.penaltyNotes}</dd>}
        </dl>
      )}

      {returned && reservation.cashPending && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2 text-xs text-warning-ink">
          <span>El efectivo del depósito aún no pasa por la caja.</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void post("settle")} disabled={busy}>
            Registrar en caja
          </Button>
        </div>
      )}

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      {runPhase && (
        <ChecklistRunDialog
          open
          onOpenChange={(o) => !o && setRunPhase(null)}
          endpoint={`/api/reservaciones/${reservation.id}/checklists`}
          template={template(runPhase)}
          lastRun={runs[runPhase] ?? null}
          canManage={canManage && !returned}
          onSaved={() => void loadChecklists()}
        />
      )}
    </div>
  );
}

/** Política de rentas: depósito sugerido, cargo por día de retraso y minutos de gracia. */
export function RentalPolicyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ defaultDeposit: "0", lateFeePerDay: "0", graceMinutes: "60" });

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoading(true);
    fetch("/api/reservaciones/policy", { cache: "no-store", credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setForm({ defaultDeposit: String(d.policy.defaultDeposit), lateFeePerDay: String(d.policy.lateFeePerDay), graceMinutes: String(d.policy.graceMinutes) });
      })
      .catch(() => setError("No se pudo cargar la política"))
      .finally(() => setLoading(false));
  }, [open]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/reservaciones/policy", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultDeposit: Number(form.defaultDeposit || 0), lateFeePerDay: Number(form.lateFeePerDay || 0), graceMinutes: Number(form.graceMinutes || 0) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "No se pudo guardar");
      toast.success("Política de rentas guardada");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogComponent
      open={open}
      onOpenChange={onOpenChange}
      icon={<ShieldCheck className="size-5 text-primary" />}
      title="Política de rentas"
      description="Depósito sugerido y cargo por entregar tarde."
      className="sm:max-w-md"
      footer={
        <>
          {error && <p className="mr-auto text-sm font-medium text-destructive">{error}</p>}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button onClick={() => void save()} disabled={saving || loading}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Guardar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <InputGroupField label="Depósito sugerido" type="number" min="0" step="0.01" value={form.defaultDeposit} onChange={(e) => setForm({ ...form, defaultDeposit: e.target.value })} hint="Se propone al crear una renta; se puede cambiar en cada una. 0 = sin depósito." />
        <InputGroupField label="Cargo por día de retraso" type="number" min="0" step="0.01" value={form.lateFeePerDay} onChange={(e) => setForm({ ...form, lateFeePerDay: e.target.value })} hint="Por cada día o fracción después de la hora de regreso. 0 = no se cobra retraso." />
        <InputGroupField label="Minutos de gracia" type="number" min="0" step="1" value={form.graceMinutes} onChange={(e) => setForm({ ...form, graceMinutes: e.target.value })} hint="Tolerancia después de la hora de regreso antes de cobrar retraso." />
      </div>
    </DialogComponent>
  );
}
