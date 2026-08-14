"use client";

import { useState } from "react";
import type { $Enums } from "@prisma/client";
import { BadgeCheck, Check, CreditCard, PiggyBank, ReceiptText, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { usePosStore } from "@/stores/pos-store";
import { usePosTotals } from "@/hooks/use-pos-totals";
import { money } from "@/lib/pos/money";
import { buildSalePayload, type PaymentEntry } from "@/lib/pos/checkout";
import { CASH_DENOMINATIONS, PAYMENT_METHOD_LABELS, POINTS_PER_PESO } from "@/lib/pos/config";
import { pointsToMoney } from "@/lib/pos/pricing";
import { Numpad, type NumpadKey } from "./numpad";
import { cn } from "@/lib/utils";

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (sale: { id: string; saleNumber: string; locationName: string }, payload: ReturnType<typeof buildSalePayload>) => void;
}

const METHODS: $Enums.PaymentMethod[] = ["cash", "card", "wallet", "other"];

export function PaymentDialog({ open, onClose, onSuccess }: PaymentDialogProps) {
  const t = usePosTotals();
  const setPointsRedeemed = usePosStore((s) => s.setPointsRedeemed);

  const [method, setMethod] = useState<$Enums.PaymentMethod>("cash");
  const [cashStr, setCashStr] = useState("");
  const [entries, setEntries] = useState<PaymentEntry[]>([]);
  const [pointsStr, setPointsStr] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const pointsRedemption = t.customer
    ? Math.min(
        Math.floor(parseFloat(pointsStr.replace(",", ".")) || 0),
        Math.floor(t.customer.points)
      )
    : 0;
  const pointsValue = pointsToMoney(pointsRedemption);

  const cashTotal = entries
    .filter((e) => e.method === "cash")
    .reduce((acc, e) => acc + e.amount, 0);
  const nonCashTotal = entries
    .filter((e) => e.method !== "cash")
    .reduce((acc, e) => acc + e.amount, 0);

  const paid = round2ToSave(nonCashTotal + cashTotal + pointsValue);
  const remaining = round2ToSave(Math.max(0, t.payable - paid));
  const cashCover = t.payable - nonCashTotal - pointsValue;
  const change = round2ToSave(Math.max(0, cashTotal - cashCover));
  const overpay = cashTotal > cashCover;

  const currentAmount = parseFloat(cashStr.replace(",", ".")) || 0;

  const onKey = (key: NumpadKey) => {
    if (key === "clear") return setCashStr("");
    if (key === "backspace") return setCashStr((s) => s.slice(0, -1));
    if (key === ".") {
      if (!cashStr.includes(".")) setCashStr(cashStr === "" ? "0." : cashStr + ".");
      return;
    }
    setCashStr(cashStr + key);
  };

  const applyPoints = () => {
    const pts = Math.max(0, Math.min(Math.floor(parseFloat(pointsStr.replace(",", ".")) || 0), Math.floor(t.customer?.points ?? 0)));
    setPointsStr(String(pts));
    if (pts !== t.pointsRedeemed) setPointsRedeemed(pts);
  };

  const addCurrentPayment = () => {
    if (currentAmount <= 0) return;
    setEntries((prev) => [...prev, { method, amount: currentAmount }]);
    setCashStr("");
  };

  const addRemaining = () => {
    if (remaining <= 0) return;
    setEntries((prev) => [...prev, { method, amount: remaining }]);
    setCashStr("");
  };

  const removeEntry = (i: number) => setEntries((prev) => prev.filter((_, idx) => idx !== i));

  const reset = () => {
    setEntries([]);
    setCashStr("");
    setPointsStr("");
    setError("");
  };

  const complete = async () => {
    if (paid - t.payable < -0.01) {
      setError("Falta por cubrir el total");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = buildSalePayload(t, entries, change);
      const res = await fetch("/api/pos/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: usePosStore.getState().location.id, payload }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "No se pudo registrar la venta");
      reset();
      onSuccess(data.sale, payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar la venta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !loading) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="scrollbar-none max-h-[92svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="size-5 text-primary" /> Cobro de venta
          </DialogTitle>
          <DialogDescription>
            Total a cobrar: <span className="font-bold text-foreground">{money(t.payable)}</span>
            {t.pointsRedeemedValue > 0 && <> · aplicando {money(t.pointsRedeemedValue)} en puntos</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Pagado: <span className="font-semibold text-foreground">{money(paid)}</span>
              </span>
              <span className="text-muted-foreground">
                Restante: <span className="font-semibold text-foreground">{money(remaining)}</span>
              </span>
            </div>
            <Progress
              value={t.payable > 0 ? Math.min(100, (paid / t.payable) * 100) : 0}
              className="h-2"
            />
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-xs font-medium transition",
                  method === m ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                {m === "cash" ? <Wallet className="size-4" /> : m === "card" ? <CreditCard className="size-4" /> : <BadgeCheck className="size-4" />}
                {PAYMENT_METHOD_LABELS[m]}
              </button>
            ))}
          </div>

          {method === "cash" && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {CASH_DENOMINATIONS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setCashStr(String(d))}
                    className="rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums transition hover:bg-muted"
                  >
                    ${d}
                  </button>
                ))}
              </div>
              <div className="rounded-xl border bg-card px-3 py-2 text-center">
                <span className="text-2xl font-bold tabular-nums">{money(currentAmount)}</span>
                {currentAmount > 0 && currentAmount >= remaining && (
                  <p className="text-xs text-emerald-600">
                    Cambio estimado: {money(Math.max(0, currentAmount - remaining))}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Numpad onKey={onKey} />
                <div className="flex flex-col gap-2">
                  <Button onClick={addCurrentPayment} disabled={currentAmount <= 0}>
                    Agregar pago
                  </Button>
                  <Button variant="outline" onClick={addRemaining} disabled={remaining <= 0}>
                    Exacto ({money(remaining)})
                  </Button>
                </div>
              </div>
            </div>
          )}

          {method !== "cash" && (
            <Button className="w-full" onClick={addRemaining} disabled={remaining <= 0}>
              Cobrar {money(remaining)} con {PAYMENT_METHOD_LABELS[method]}
            </Button>
          )}

          {t.customer && t.customer.points >= POINTS_PER_PESO && (
            <div className="space-y-1.5 rounded-xl border bg-amber-500/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                <PiggyBank className="size-4" /> Puntos del cliente
              </p>
              <div className="flex gap-2">
                <Input
                  value={pointsStr}
                  onChange={(e) => setPointsStr(e.target.value.replace(/\D/g, ""))}
                  placeholder={`disponibles: ${Math.floor(t.customer.points)} pts`}
                  inputMode="numeric"
                  className="h-9"
                />
                <Button variant="outline" size="sm" onClick={applyPoints} className="h-9">
                  Aplicar ({money(pointsValue)})
                </Button>
              </div>
            </div>
          )}

          {entries.length > 0 && (
            <div className="space-y-1">
              {entries.map((e, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border px-3 py-1.5 text-sm">
                  <span className="text-muted-foreground">{PAYMENT_METHOD_LABELS[e.method]}</span>
                  <span className="font-semibold tabular-nums">{money(e.amount)}</span>
                  <button type="button" onClick={() => removeEntry(i)} className="text-xs text-destructive">
                    quitar
                  </button>
                </div>
              ))}
            </div>
          )}

          {change > 0 && (
            <div className={cn("rounded-xl border p-3 text-center", overpay ? "border-amber-400 bg-amber-500/10" : "border-emerald-500/40 bg-emerald-500/10")}>
              {overpay ? (
                <p className="text-sm">
                  El cliente entregó de más: <span className="font-bold">{money(change)}</span> de cambio.
                </p>
              ) : (
                <p className="text-sm">
                  Cambio a entregar: <span className="font-bold">{money(change)}</span>
                </p>
              )}
            </div>
          )}

          {error && <p className="text-center text-xs text-destructive">{error}</p>}

          <Button
            size="lg"
            className="w-full"
            disabled={loading || paid - t.payable < -0.01}
            onClick={complete}
          >
            <Check className="size-4" />
            {loading ? "Registrando…" : `Completar venta · ${money(paid)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function round2ToSave(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}