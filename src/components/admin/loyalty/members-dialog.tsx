"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, Loader2, SlidersHorizontal, UserMinus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogComponent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { InputGroupField } from "@/components/base/input-group-field";
import { TextareaField } from "@/components/base/textarea-field";
import { swalError, swalToast } from "@/lib/swal";
import { cn } from "@/lib/utils";

interface Member {
  customerId: string;
  customerName: string;
  phone: string | null;
  status: "active" | "expired" | "cancelled";
  startedAt: string | null;
  expiresAt: string | null;
  daysLeft: number | null;
  credits: number;
  usableCredits: number;
  autoRenew: boolean;
  billingStatus: string | null;
}

type ActionKind = "cancel" | "extend" | "adjust";

const STATUS: Record<Member["status"], { label: string; chip: string }> = {
  active: { label: "Vigente", chip: "bg-success/15 text-success-ink" },
  expired: { label: "Vencida", chip: "bg-warning/15 text-warning-ink" },
  cancelled: { label: "Dada de baja", chip: "bg-muted text-muted-foreground" },
};
const dateLabel = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—");

/** Miembros de una membresía: quién está vigente, cuándo vence y acciones manuales (baja, cortesía, ajuste de créditos). */
export function MembersDialog({ programId, programName, canManage, onClose, onChanged }: { programId: string | null; programName: string; canManage: boolean; onClose: () => void; onChanged?: () => void }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [action, setAction] = useState<{ kind: ActionKind; member: Member } | null>(null);
  const [days, setDays] = useState("7");
  const [credits, setCredits] = useState("1");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!programId) return;
    try {
      const res = await fetch(`/api/loyalty-programs/${programId}/members`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "No se pudieron cargar los miembros");
      setMembers(json.members);
    } catch (err) {
      setMembers([]);
      swalError("No se pudieron cargar los miembros", err instanceof Error ? err.message : undefined);
    }
  }, [programId]);

  useEffect(() => {
    setMembers(null);
    setAction(null);
    if (programId) void load();
  }, [programId, load]);

  const open = (kind: ActionKind, member: Member) => {
    setAction({ kind, member });
    setNote("");
    setError(null);
    setDays("7");
    setCredits("1");
  };

  const submit = async () => {
    if (!action || !programId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/loyalty-programs/${programId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: action.member.customerId, action: action.kind, days: Number(days), credits: Number(credits), note }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "No se pudo guardar");
      swalToast(action.kind === "cancel" ? "Membresía dada de baja" : action.kind === "extend" ? "Días de cortesía agregados" : "Créditos ajustados");
      setAction(null);
      void load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogComponent
        open={programId !== null}
        onOpenChange={(o) => !o && onClose()}
        icon={<Users className="size-5 text-primary" />}
        title={`Miembros · ${programName}`}
        description="Quién tiene la membresía, cuándo vence y cuántos servicios le quedan. Para dar de alta o renovar, cobra la cuota en caja."
        className="sm:max-w-2xl"
        bodyClassName="space-y-2"
        footer={<Button variant="ghost" onClick={onClose}>Cerrar</Button>}
      >
        {members === null ? (
          <Skeleton className="h-32 rounded-xl" />
        ) : members.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Aún nadie tiene esta membresía. Aparecerán aquí cuando cobres la cuota a un cliente en caja.</p>
        ) : (
          members.map((m) => (
            <div key={m.customerId} className="space-y-2 rounded-xl border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.customerName}</p>
                  <p className="text-xs text-muted-foreground">{m.phone ?? "Sin teléfono"}</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS[m.status].chip)}>{STATUS[m.status].label}</span>
              </div>
              <p className="text-xs tabular-nums text-muted-foreground">
                {m.status === "active" ? `Vence el ${dateLabel(m.expiresAt)} · faltan ${m.daysLeft} día(s)` : `${m.status === "cancelled" ? "Baja" : "Venció"} el ${dateLabel(m.expiresAt)}`} · {m.usableCredits} servicio(s) disponibles
                {m.autoRenew ? ` · renovación automática${m.billingStatus === "awaiting_payment" ? " (esperando el pago)" : m.billingStatus === "failed" ? " (el último enlace caducó)" : ""}` : ""}
              </p>
              {canManage && (
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => open("extend", m)}><CalendarPlus className="size-4" /> Cortesía de días</Button>
                  <Button size="sm" variant="outline" onClick={() => open("adjust", m)}><SlidersHorizontal className="size-4" /> Ajustar servicios</Button>
                  {m.status === "active" && <Button size="sm" variant="outline" className="text-destructive" onClick={() => open("cancel", m)}><UserMinus className="size-4" /> Dar de baja</Button>}
                </div>
              )}
            </div>
          ))
        )}
      </DialogComponent>

      <DialogComponent
        open={action !== null}
        onOpenChange={(o) => !o && setAction(null)}
        icon={<SlidersHorizontal className="size-5 text-primary" />}
        title={action?.kind === "cancel" ? "Dar de baja la membresía" : action?.kind === "extend" ? "Cortesía de días" : "Ajustar servicios"}
        description={action ? `${action.member.customerName} · el movimiento queda en el historial con tu motivo.` : undefined}
        className="sm:max-w-md"
        bodyClassName="space-y-3"
        footer={
          <>
            {error && <p className="mr-auto text-sm font-medium text-destructive">{error}</p>}
            <Button variant="ghost" onClick={() => setAction(null)}>Cancelar</Button>
            <Button onClick={() => void submit()} disabled={saving} variant={action?.kind === "cancel" ? "destructive" : "default"}>
              {saving && <Loader2 className="size-4 animate-spin" />} {action?.kind === "cancel" ? "Dar de baja" : "Guardar"}
            </Button>
          </>
        }
      >
        {action?.kind === "cancel" && <p className="text-sm text-muted-foreground">La membresía termina hoy y sus servicios dejan de poder canjearse. Si el cliente vuelve, basta cobrarle la cuota otra vez.</p>}
        {action?.kind === "extend" && <InputGroupField label="Días a sumar" required type="number" inputMode="numeric" min={1} max={366} rightAddon="días" value={days} onChange={(e) => setDays(e.target.value)} helper="Si ya venció, la membresía se reactiva desde hoy." />}
        {action?.kind === "adjust" && <InputGroupField label="Servicios a sumar o restar" required type="number" inputMode="numeric" min={-100} max={100} value={credits} onChange={(e) => setCredits(e.target.value)} helper="Usa un número negativo para restar (por ejemplo −1)." />}
        <TextareaField label="Motivo" required value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Por qué lo haces (por ejemplo: cortesía por retraso)" />
      </DialogComponent>
    </>
  );
}
