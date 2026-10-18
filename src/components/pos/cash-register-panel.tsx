"use client";

import { useEffect, useState } from "react";
import { HandCoins, LockKeyhole, Unlock } from "lucide-react";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { InputGroupField } from "@/components/base/input-group-field";
import { FormCombobox } from "@/components/base/form-combobox";
import { EXPENSE_CATEGORIES } from "@/lib/expenses/shared";
import { usePosStore } from "@/stores/pos-store";
import { money } from "@/lib/pos/money";
import { playSound } from "@/lib/sounds";
import { swalToast, swalError } from "@/lib/swal";
import { usePosRefresh } from "@/hooks/use-pos-refresh";
import { CashDiscrepancyDialog, type CashCloseSummary } from "./cash-discrepancy-dialog";

interface CashRegisterPanelProps {
  open: boolean;
  onClose: () => void;
}

interface SessionStats {
  todaySales: number;
  todayCount: number;
  session: { sales: number; cashPayments: number; changeGiven: number; cashRefunds: number; cashExpenses: number } | null;
}

export function CashRegisterPanel({ open, onClose }: CashRegisterPanelProps) {
  const session = usePosStore((s) => s.session);
  const registers = usePosStore((s) => s.registers);
  const registerId = usePosStore((s) => s.registerId);
  const setRegister = usePosStore((s) => s.setRegister);
  const refresh = usePosRefresh();

  const [stats, setStats] = useState<SessionStats | null>(null);
  const [openingCash, setOpeningCash] = useState("");
  const [closingCash, setClosingCash] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  // Retiro de efectivo con motivo (queda como gasto de la caja).
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [wAmount, setWAmount] = useState("");
  const [wReason, setWReason] = useState("");
  const [wCategory, setWCategory] = useState("cash_withdrawal");
  const [wError, setWError] = useState<string | null>(null);
  const [closeSummary, setCloseSummary] = useState<CashCloseSummary | null>(null);

  useEffect(() => {
    if (!open) return;
    setOpeningCash("");
    setClosingCash("");
    setNotes("");
    setWithdrawOpen(false);
    setWAmount("");
    setWReason("");
    setWCategory("cash_withdrawal");
    setWError(null);
    fetch(`/api/pos/cash?locationId=${encodeURIComponent(usePosStore.getState().location.id)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.ok && setStats(d))
      .catch(() => undefined);
  }, [open]);

  const doOpen = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pos/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open",
          registerId,
          openingCash: parseFloat(openingCash.replace(",", ".")) || 0,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        swalError("No se pudo abrir la caja", data.error);
        return;
      }
      await refresh();
      playSound("cash-open");
      swalToast(data.created ? "Caja abierta" : "Caja ya abierta");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const doClose = async () => {
    if (!session) return;
    const amount = parseFloat(closingCash.replace(",", "."));
    if (isNaN(amount) || amount < 0) {
      swalError("Ingresa un monto de cierre válido");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/pos/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "close",
          sessionId: session.id,
          closingCash: amount,
          notes,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        swalError("No se pudo cerrar la caja", data.error);
        return;
      }
      await refresh();
      playSound("cash-close");
      setCloseSummary(data.summary as CashCloseSummary);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const expected = stats?.session
    ? stats.session.cashPayments +
      (session?.openingCash ?? 0) -
      stats.session.changeGiven -
      stats.session.cashRefunds -
      stats.session.cashExpenses
    : 0;

  const doWithdraw = async () => {
    const amount = parseFloat(wAmount.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return setWError("Escribe cuánto dinero sacas de la caja");
    if (!wReason.trim()) return setWError("Escribe para qué sacas el dinero");
    if (!session) return;
    setLoading(true);
    setWError(null);
    try {
      const res = await fetch("/api/pos/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "withdraw", sessionId: session.id, amount, description: wReason.trim(), category: wCategory }),
      });
      const data = await res.json();
      if (!data.ok) return setWError(data.error ?? "No se pudo registrar el retiro");
      swalToast(`Retiro de ${money(amount)} registrado`);
      setWithdrawOpen(false);
      setWAmount("");
      setWReason("");
      const fresh = await fetch(`/api/pos/cash?locationId=${encodeURIComponent(usePosStore.getState().location.id)}`, { cache: "no-store" }).then((r) => r.json());
      if (fresh.ok) setStats(fresh);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <DialogComponent
      open={open}
      onOpenChange={(o) => !o && onClose()}
      icon={session ? <Unlock className="size-5 text-success-ink" /> : <LockKeyhole className="size-5 text-primary" />}
      title={session ? "Caja abierta" : "Abrir caja"}
      description={`Sucursal ${usePosStore.getState().location.name} · ${stats?.todayCount ?? 0} ventas hoy · ${money(stats?.todaySales ?? 0)}`}
      className="sm:max-w-md"
      bodyClassName="space-y-3"
      footerClassName="gap-2"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          {session ? (
            <Button className="flex-1" onClick={doClose} disabled={loading}>
              {loading ? "Contabilizando…" : "Cerrar caja y cortar"}
            </Button>
          ) : (
            <Button className="flex-1" onClick={doOpen} disabled={loading || !registerId}>
              {loading ? "Abriendo…" : "Abrir caja"}
            </Button>
          )}
        </>
      }
    >
          {session ? (
          <div className="space-y-3">
            <div className="rounded-xl border bg-card p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Caja registradora</span>
                <span className="font-medium">{session.registerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Apertura</span>
                <span className="font-medium tabular-nums">{money(session.openingCash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Abierta desde</span>
                <span>{new Date(session.openedAt).toLocaleString("es-MX")}</span>
              </div>
              {(stats?.session?.cashExpenses ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Retiros y gastos</span>
                  <span className="font-medium tabular-nums text-destructive">-{money(stats?.session?.cashExpenses ?? 0)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1">
                <span className="text-muted-foreground">Esperado en caja</span>
                <span className="font-bold tabular-nums">{money(expected)}</span>
              </div>
            </div>
            <div className="rounded-xl border bg-card p-3">
              {!withdrawOpen ? (
                <Button type="button" variant="outline" className="w-full justify-start gap-2" onClick={() => setWithdrawOpen(true)}>
                  <HandCoins className="size-4" /> Retirar efectivo (pago a proveedor, gasto…)
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-semibold">Retirar efectivo de la caja</p>
                  <InputGroupField required
                    id="withdrawAmount"
                    label="¿Cuánto sacas? ($)"
                    leftIcon={<span className="text-sm">$</span>}
                    value={wAmount}
                    onChange={(e) => setWAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                  <InputGroupField required
                    id="withdrawReason"
                    label="¿Para qué es?"
                    value={wReason}
                    onChange={(e) => setWReason(e.target.value)}
                    placeholder="Ej. Pago al proveedor de refrescos"
                    maxLength={190}
                  />
                  <FormCombobox
                    id="withdrawCategory"
                    label="Tipo de gasto"
                    options={EXPENSE_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
                    value={wCategory}
                    onChange={setWCategory}
                  />
                  {wError && <p role="alert" className="text-sm text-destructive">{wError}</p>}
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" onClick={() => setWithdrawOpen(false)} disabled={loading}>Cancelar</Button>
                    <Button type="button" className="flex-1" onClick={doWithdraw} disabled={loading}>{loading ? "Guardando…" : "Registrar retiro"}</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Se descuenta del efectivo esperado y queda anotado en Gastos.</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <InputGroupField
                id="closingCash"
                label="Monto final en caja ($)"
                leftIcon={<span className="text-sm">$</span>}
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value.replace(/[^\d.,]/g, ""))}
                placeholder="0.00"
                inputMode="decimal"
                autoFocus
              />
              <InputGroupField
                label="Notas del corte (opcional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas del corte"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="register">Caja registradora</Label>
              <Select value={registerId} onValueChange={setRegister}>
                <SelectTrigger id="register">
                  <SelectValue placeholder="Selecciona caja" />
                </SelectTrigger>
                <SelectContent>
                  {registers.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                      {r.folioPrefix ? ` (${r.folioPrefix})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <InputGroupField
                id="openingCash"
                label="Fondo inicial en caja ($)"
                leftIcon={<span className="text-sm">$</span>}
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value.replace(/[^\d.,]/g, ""))}
                placeholder="0.00"
                inputMode="decimal"
              />
            </div>
          </div>
          )}
    </DialogComponent>

      <CashDiscrepancyDialog
        open={closeSummary !== null}
        onClose={() => setCloseSummary(null)}
        summary={closeSummary}
      />
    </>
  );
}
