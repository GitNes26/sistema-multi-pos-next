"use client";

import { useEffect, useState } from "react";
import type { $Enums } from "@prisma/client";
import { motion } from "framer-motion";
import {
  Banknote,
  BadgeCheck,
  CreditCard,
  Landmark,
  MoreHorizontal,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { money, round2 } from "@/lib/pos/money";
import { playSound } from "@/lib/sounds";
import { ordersApi, type OrderDetail } from "@/lib/orders/client";
import {
  CASH_DENOMINATIONS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/pos/config";
import { Numpad, type NumpadKey } from "@/components/pos/numpad";
import { cn } from "@/lib/utils";

// Diálogo para cobrar un pedido pendiente en tienda (recoger o recibir).

interface OrderPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderDetail;
  onPaid: () => void;
}

const METHODS: $Enums.PaymentMethod[] = ["cash", "card", "wallet", "credit", "other"];

const METHOD_ICONS: Partial<Record<$Enums.PaymentMethod, React.ReactNode>> = {
  cash: <Banknote className="size-4" />,
  card: <CreditCard className="size-4" />,
  wallet: <Wallet className="size-4" />,
  credit: <Landmark className="size-4" />,
  other: <MoreHorizontal className="size-4" />,
};

export function OrderPaymentDialog({ open, onOpenChange, order, onPaid }: OrderPaymentDialogProps) {
  const [method, setMethod] = useState<$Enums.PaymentMethod>("cash");
  const [cashStr, setCashStr] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const amount = parseFloat(cashStr.replace(",", ".")) || 0;
  const change = round2(Math.max(0, amount - order.total));

  useEffect(() => {
    if (open) {
      setMethod("cash");
      setCashStr("");
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

  const setExact = () => setCashStr(String(order.total));

  const confirm = async (m: $Enums.PaymentMethod = method, payAmount: number = amount) => {
    if (payAmount < order.total - 0.01) {
      setError("El monto no cubre el total del pedido");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await ordersApi.payOrder(order.id, { method: m, reference: reference.trim() || null });
      playSound("sale-complete");
      onPaid();
      onOpenChange(false);
    } catch (err) {
      playSound("error");
      setError(err instanceof Error ? err.message : "No se pudo cobrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DialogComponent
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      icon={<ReceiptText className="size-5 text-primary" />}
      title={`Cobrar pedido #${order.orderNumber}`}
      description={`${order.customerName ?? "Cliente"} · Total a cobrar: ${money(order.total)}`}
      bodyClassName="space-y-3"
      footer={
        <Button
          size="lg"
          className="h-14 w-full text-base font-bold"
          disabled={loading || amount < order.total - 0.01}
          onClick={() => confirm(method, amount)}
        >
          <BadgeCheck className="size-5" />
          {loading ? "Cobrando…" : `Cobrar ${money(amount || order.total)}`}
        </Button>
      }
    >
      {/* Total */}
      <div className="rounded-2xl border bg-muted/30 p-4 text-center">
        <p className="text-sm text-muted-foreground">Total del pedido</p>
        <p className="text-3xl font-black tabular-nums">{money(order.total)}</p>
        {change > 0 && amount > 0 && (
          <p className="mt-1 text-sm font-semibold text-emerald-600">Cambio: {money(change)}</p>
        )}
      </div>

      {/* Método */}
      <div className="grid grid-cols-4 gap-1.5">
        {METHODS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[10px] font-medium transition",
              method === m ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
            )}
          >
            {METHOD_ICONS[m]}
            {PAYMENT_METHOD_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Pago exacto rápido */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => confirm("cash", order.total)}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-[0.97]"
        >
          <Banknote className="size-5" /> Efectivo exacto
        </button>
        <button
          type="button"
          onClick={() => confirm("card", order.total)}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 active:scale-[0.97]"
        >
          <CreditCard className="size-5" /> Tarjeta exacta
        </button>
      </div>

      {/* Denominaciones */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Denominaciones (efectivo)</p>
        <div className="grid grid-cols-3 gap-1.5">
          {CASH_DENOMINATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setCashStr(String(d))}
              className="rounded-xl border bg-background py-2.5 text-sm font-bold tabular-nums transition hover:bg-muted active:scale-[0.97]"
            >
              ${d}
            </button>
          ))}
        </div>
      </div>

      {/* Monto personalizado */}
      <div className="grid grid-cols-2 gap-3">
        <Numpad onKey={onKey} onEnter={() => confirm(method, amount)} />
        <div className="flex flex-col justify-between gap-2">
          <div className="rounded-xl border bg-card px-3 py-3 text-center">
            <span className="text-2xl font-bold tabular-nums">{money(amount)}</span>
          </div>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Referencia (opcional)"
            className="h-9"
          />
          <Button variant="outline" onClick={setExact}>
            Exacto ({money(order.total)})
          </Button>
        </div>
      </div>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg bg-destructive/10 px-3 py-2 text-center text-xs font-medium text-destructive"
        >
          {error}
        </motion.p>
      )}
    </DialogComponent>
  );
}
