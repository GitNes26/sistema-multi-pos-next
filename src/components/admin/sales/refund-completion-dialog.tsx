"use client";

import { useEffect, useMemo, useState } from "react";
import * as yup from "yup";
import { Banknote, CreditCard, Landmark, Loader2, ReceiptText, RotateCcw, WalletCards } from "lucide-react";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputGroupField } from "@/components/base/input-group-field";
import { FormCombobox } from "@/components/base/form-combobox";
import { useFocusInvalid } from "@/hooks/use-focus-invalid";
import { salesApi, type SaleReturnDetail } from "@/lib/api";
import { money } from "@/lib/pos/money";

type RefundMethod = "cash" | "card" | "wallet" | "other";
type Allocation = { method: RefundMethod; amount: string; reference: string };

const METHOD_META: Record<RefundMethod, { label: string; icon: React.ReactNode }> = {
  cash: { label: "Efectivo", icon: <Banknote className="size-4" /> },
  card: { label: "Tarjeta", icon: <CreditCard className="size-4" /> },
  wallet: { label: "Wallet", icon: <WalletCards className="size-4" /> },
  other: { label: "Otro medio", icon: <ReceiptText className="size-4" /> },
};

const schema = yup.object({
  payments: yup.array().of(yup.object({
    method: yup.string().oneOf(["cash", "card", "wallet", "other"]).required(),
    amount: yup.number().transform((value, original) => original === "" ? undefined : value)
      .typeError("Ingresa un importe válido").moreThan(0, "Debe ser mayor que cero").required("El importe es obligatorio"),
    reference: yup.string().trim().when("method", {
      is: (method: RefundMethod) => method !== "cash",
      then: (value) => value.required("Agrega la referencia o comprobante"),
    }),
  })).min(1, "No hay un medio compatible para reembolsar").required(),
});

function initialAllocations(detail: SaleReturnDetail): Allocation[] {
  const capacity = new Map<RefundMethod, number>();
  for (const payment of detail.refundAvailability ?? []) {
    capacity.set(payment.method, Number(payment.amount));
  }
  let remaining = Number(detail.total);
  return [...capacity]
    .map(([method, available]) => {
      const amount = Math.min(remaining, available);
      remaining = Math.max(0, Math.round((remaining - amount) * 100) / 100);
      return { method, amount: amount > 0 ? amount.toFixed(2) : "", reference: "" };
    })
    .filter((payment) => Number(payment.amount) > 0);
}

export function RefundCompletionDialog({
  open,
  onOpenChange,
  detail,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detail: SaleReturnDetail | null;
  onCompleted: () => void;
}) {
  const formId = "refund-completion-form";
  const { focusFirstEnabled, focusFirstInvalid } = useFocusInvalid();
  const [payments, setPayments] = useState<Allocation[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [cashSessionId, setCashSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !detail) return;
    setPayments(initialAllocations(detail));
    setCashSessionId(detail.openCashSessions[0]?.id ?? null);
    setErrors({});
    const frame = requestAnimationFrame(() => focusFirstEnabled(formId));
    return () => cancelAnimationFrame(frame);
  }, [detail, focusFirstEnabled, open]);

  const allocated = useMemo(
    () => Math.round(payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0) * 100) / 100,
    [payments]
  );

  if (!detail) return null;

  const submit = async () => {
    const fieldErrors: Record<string, string> = {};
    try {
      await schema.validate({ payments }, { abortEarly: false });
      if (Math.abs(allocated - Number(detail.total)) > 0.009) {
        fieldErrors.refundTotal = `Distribuye exactamente ${money(Number(detail.total))}`;
        throw new yup.ValidationError(fieldErrors.refundTotal, allocated, "refundTotal");
      }
      if (payments.some((payment) => payment.method === "cash" && Number(payment.amount) > 0) && !cashSessionId) {
        fieldErrors["refund-cash-session"] = "Abre o selecciona una caja en esta sucursal";
        throw new yup.ValidationError(fieldErrors["refund-cash-session"], cashSessionId, "refund-cash-session");
      }
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        for (const issue of error.inner.length ? error.inner : [error]) {
          const match = issue.path?.match(/^payments\[(\d+)]\.(amount|reference)$/);
          const key = match ? `refund-${match[2]}-${match[1]}` : issue.path ?? "refundTotal";
          if (!fieldErrors[key]) fieldErrors[key] = issue.message;
        }
        setErrors(fieldErrors);
        requestAnimationFrame(() => focusFirstInvalid(fieldErrors, formId));
        return;
      }
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      const response = await salesApi.completeReturn(detail.id, payments.map((payment) => ({
        method: payment.method,
        amount: Number(payment.amount),
        reference: payment.reference.trim() || undefined,
      })), cashSessionId ?? undefined);
      if (!response.return) throw new Error("El servidor no devolvió la operación completada");
      onCompleted();
      onOpenChange(false);
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "No se pudo registrar el reembolso" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogComponent
      open={open}
      onOpenChange={(next) => !submitting && onOpenChange(next)}
      icon={<RotateCcw className="size-5" />}
      title="Registrar entrega del reembolso"
      description="Distribuye el total entre los medios usados en la venta. Para tarjeta, wallet u otro medio, captura la referencia del comprobante."
      size="md"
      bodyClassName="space-y-4"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Confirmar reembolso
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={(event) => { event.preventDefault(); void submit(); }} className="space-y-3">
        {payments.some((payment) => payment.method === "cash" && Number(payment.amount) > 0) && (
          <FormCombobox
            id="refund-cash-session"
            label="Caja que entrega el efectivo"
            icon={<Landmark className="size-4" />}
            options={detail.openCashSessions.map((session) => ({ value: session.id, label: session.label }))}
            value={cashSessionId}
            onChange={setCashSessionId}
            placeholder="Selecciona una caja abierta"
            emptyText="No hay cajas abiertas en esta sucursal"
            searchable={false}
            clearable={false}
            error={errors["refund-cash-session"]}
            required
          />
        )}
        {payments.map((payment, index) => {
          const meta = METHOD_META[payment.method];
          return (
            <div key={payment.method} className="grid gap-3 rounded-xl border bg-muted/30 p-3 sm:grid-cols-2">
              <InputGroupField
                id={`refund-amount-${index}`}
                label={`Importe en ${meta.label}`}
                leftIcon={meta.icon}
                inputMode="decimal"
                value={payment.amount}
                onChange={(event) => setPayments((current) => current.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, amount: event.target.value } : item
                ))}
                error={errors[`refund-amount-${index}`]}
                required
              />
              {payment.method !== "cash" && (
                <InputGroupField
                  id={`refund-reference-${index}`}
                  label="Referencia o comprobante"
                  leftIcon={<ReceiptText className="size-4" />}
                  value={payment.reference}
                  onChange={(event) => setPayments((current) => current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, reference: event.target.value } : item
                  ))}
                  error={errors[`refund-reference-${index}`]}
                  required
                />
              )}
            </div>
          );
        })}

        <div data-form-field="refundTotal" className="flex items-center justify-between rounded-xl border p-3 text-sm">
          <span className="text-muted-foreground">Total distribuido</span>
          <span className="font-bold tabular-nums">{money(allocated)} / {money(Number(detail.total))}</span>
        </div>
        {errors.refundTotal && <p className="text-sm text-destructive" role="alert">{errors.refundTotal}</p>}
        {errors.form && <p className="text-sm text-destructive" role="alert">{errors.form}</p>}
      </form>
    </DialogComponent>
  );
}
