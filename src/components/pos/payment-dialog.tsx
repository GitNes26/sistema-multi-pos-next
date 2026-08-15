"use client";

import { useEffect, useState } from "react";
import type { $Enums } from "@prisma/client";
import { AnimatePresence, motion } from "framer-motion";
import {
  Banknote,
  BadgeCheck,
  Check,
  CreditCard,
  MoreHorizontal,
  PiggyBank,
  ReceiptText,
  Trash2,
  Wallet,
} from "lucide-react";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatedNumber } from "@/components/base/animated-number";
import { usePosStore } from "@/stores/pos-store";
import { usePosTotals } from "@/hooks/use-pos-totals";
import { money, round2 } from "@/lib/pos/money";
import { playSound } from "@/lib/sounds";
import { buildSalePayload, type PaymentEntry } from "@/lib/pos/checkout";
import { CASH_DENOMINATIONS, PAYMENT_METHOD_LABELS, POINTS_PER_PESO } from "@/lib/pos/config";
import { Numpad, type NumpadKey } from "./numpad";
import { cn } from "@/lib/utils";

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (sale: { id: string; saleNumber: string; locationName: string }, payload: ReturnType<typeof buildSalePayload>) => void;
}

const METHODS: $Enums.PaymentMethod[] = ["cash", "card", "wallet", "other"];

const METHOD_ICONS: Partial<Record<$Enums.PaymentMethod, React.ReactNode>> = {
  cash: <Banknote className="size-5" />,
  card: <CreditCard className="size-5" />,
  wallet: <Wallet className="size-5" />,
  other: <MoreHorizontal className="size-5" />,
};

export function PaymentDialog({ open, onClose, onSuccess }: PaymentDialogProps) {
  const t = usePosTotals();
  const setPointsRedeemed = usePosStore((s) => s.setPointsRedeemed);

  const [method, setMethod] = useState<$Enums.PaymentMethod>("cash");
  const [cashStr, setCashStr] = useState("");
  const [entries, setEntries] = useState<PaymentEntry[]>([]);
  const [pointsStr, setPointsStr] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const maxPoints = t.customer
    ? Math.max(0, Math.min(Math.floor(t.customer.points), Math.ceil(t.total * POINTS_PER_PESO)))
    : 0;

  // Pagado = solo dinero recibido (efectivo/tarjeta/wallet). Los puntos ya se
  // descuentan de t.payable (NO se suman aquí; antes se contaban doble).
  const paid = round2(entries.reduce((s, e) => s + e.amount, 0));
  const remaining = round2(Math.max(0, t.payable - paid));
  const change = round2(Math.max(0, paid - t.payable));
  const progress = t.payable > 0 ? Math.min(100, (paid / t.payable) * 100) : 0;

  const currentAmount = parseFloat(cashStr.replace(",", ".")) || 0;

  useEffect(() => {
    if (open) {
      setEntries([]);
      setCashStr("");
      setPointsStr("");
      setReference("");
      setError("");
    }
  }, [open]);

  const onKey = (key: NumpadKey) => {
    if (key === "clear") return setCashStr("");
    if (key === "backspace") return setCashStr((s) => s.slice(0, -1));
    if (key === ".") {
      if (!cashStr.includes(".")) setCashStr(cashStr === "" ? "0." : cashStr + ".");
      return;
    }
    setCashStr(cashStr + key);
  };

  const applyPoints = (pts: number) => {
    setPointsRedeemed(Math.max(0, Math.min(pts, maxPoints)));
    setPointsStr("");
  };

  const addPayment = (m: $Enums.PaymentMethod, amount: number) => {
    if (amount <= 0) return;
    setEntries((prev) => [
      ...prev,
      { method: m, amount: round2(amount), reference: reference.trim() || undefined },
    ]);
    setCashStr("");
    setReference("");
  };

  const addCurrentPayment = () => addPayment(method, currentAmount);
  const addRemaining = (m: $Enums.PaymentMethod = method) => addPayment(m, remaining);
  const removeEntry = (i: number) => setEntries((prev) => prev.filter((_, idx) => idx !== i));

  const reset = () => {
    setEntries([]);
    setCashStr("");
    setPointsStr("");
    setReference("");
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
      playSound("sale-complete");
      reset();
      onSuccess(data.sale, payload);
    } catch (err) {
      playSound("error");
      setError(err instanceof Error ? err.message : "Error al registrar la venta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogComponent
      open={open}
      onOpenChange={(o) => {
        if (!o && !loading) {
          reset();
          onClose();
        }
      }}
      icon={<ReceiptText className="size-5 text-primary" />}
      title="Cobro de venta"
      description={
        <>
          {t.pointsRedeemed > 0 && (
            <>Aplicando {t.pointsRedeemed} pts ({money(t.pointsRedeemedValue)}) en puntos · </>
          )}
          Restante a pagar: {money(t.payable)}
        </>
      }
      className="sm:max-w-lg"
      bodyClassName="space-y-3"
      footer={
        <Button
          size="lg"
          className="w-full"
          disabled={loading || paid - t.payable < -0.01}
          onClick={complete}
        >
          <BadgeCheck className="size-4" />
          {loading ? "Registrando…" : `Completar venta · ${money(t.payable)}`}
        </Button>
      }
    >
          {/* Total + progreso */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-end justify-between">
              <span className="text-sm text-muted-foreground">Total a cobrar</span>
              <AnimatedNumber value={t.payable} format={money} className="text-2xl font-black tabular-nums" />
            </div>
            <Progress value={progress} className="mt-3 h-2" />
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted-foreground">
                Pagado <span className="font-semibold text-foreground tabular-nums">{money(paid)}</span>
              </span>
              {remaining > 0 ? (
                <span className="font-semibold text-destructive tabular-nums">Falta {money(remaining)}</span>
              ) : (
                <span className="font-semibold text-emerald-600 tabular-nums">Cambio {money(change)}</span>
              )}
            </div>
          </div>

          {/* Pagos agregados */}
          <AnimatePresence initial={false}>
            {entries.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-1.5">
                {entries.map((e, i) => (
                  <motion.div
                    key={`${e.method}-${i}`}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-sm"
                  >
                    {METHOD_ICONS[e.method]}
                    <span className="min-w-0 flex-1 truncate">
                      {PAYMENT_METHOD_LABELS[e.method]}
                      {e.reference && <span className="text-muted-foreground"> · {e.reference}</span>}
                    </span>
                    <span className="font-bold tabular-nums">{money(e.amount)}</span>
                    <button type="button" onClick={() => removeEntry(i)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-4" />
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Puntos del cliente */}
          {t.customer && t.customer.points >= POINTS_PER_PESO && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                <PiggyBank className="size-4" /> Puntos del cliente
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <Input
                  value={pointsStr}
                  onChange={(e) => setPointsStr(e.target.value.replace(/\D/g, ""))}
                  placeholder={`disponibles: ${Math.floor(t.customer.points)} pts`}
                  inputMode="numeric"
                  className="h-9"
                />
                <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => applyPoints(Number(pointsStr))}>
                  Aplicar
                </Button>
                <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => applyPoints(maxPoints)} disabled={maxPoints <= 0}>
                  Máximo
                </Button>
              </div>
              {t.pointsRedeemed > 0 && (
                <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                  Canjeando {t.pointsRedeemed} pts = -{money(t.pointsRedeemedValue)}
                  <button type="button" className="ml-2 underline" onClick={() => applyPoints(0)}>quitar</button>
                </p>
              )}
            </div>
          )}

          {/* Referencia opcional para el siguiente pago */}
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Referencia (opcional) — últimos 4, folio…"
            className="h-9"
          />

          {/* Pago rápido / personalizado */}
          <Tabs defaultValue="quick">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="quick">Pago rápido</TabsTrigger>
              <TabsTrigger value="custom">Pago personalizado</TabsTrigger>
            </TabsList>

            <TabsContent value="quick" className="space-y-3 pt-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    disabled={remaining <= 0}
                    onClick={() => addRemaining(m)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-medium transition hover:bg-muted disabled:opacity-40"
                    )}
                  >
                    {METHOD_ICONS[m]}
                    {PAYMENT_METHOD_LABELS[m]}
                    <span className="tabular-nums opacity-70">{money(remaining)}</span>
                  </button>
                ))}
              </div>
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">Efectivo recibido (denominaciones)</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {CASH_DENOMINATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => addPayment("cash", d)}
                      className="rounded-lg border bg-background py-2 text-sm font-semibold hover:bg-muted"
                    >
                      ${d}
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="custom" className="space-y-3 pt-3">
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
                    {METHOD_ICONS[m]}
                    {PAYMENT_METHOD_LABELS[m]}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Numpad onKey={onKey} onEnter={addCurrentPayment} />
                <div className="flex flex-col gap-2">
                  <div className="rounded-xl border bg-card px-3 py-2 text-center">
                    <span className="text-2xl font-bold tabular-nums">{money(currentAmount)}</span>
                  </div>
                  <Button onClick={addCurrentPayment} disabled={currentAmount <= 0}>
                    <Check className="size-4" /> Agregar pago
                  </Button>
                  <Button variant="outline" onClick={() => addRemaining(method)} disabled={remaining <= 0}>
                    Exacto ({money(remaining)})
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {error && <p className="text-center text-xs text-destructive">{error}</p>}
    </DialogComponent>
  );
}
