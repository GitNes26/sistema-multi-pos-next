"use client";

import { useEffect, useMemo, useState } from "react";
import * as yup from "yup";
import { Banknote, CreditCard, Landmark, Loader2, ReceiptText, RotateCcw, WalletCards } from "lucide-react";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputGroupField } from "@/components/base/input-group-field";
import { FormCombobox } from "@/components/base/form-combobox";
import { useFocusInvalid } from "@/hooks/use-focus-invalid";
import { salesApi, type ReturnSettlement, type SaleReturnDetail } from "@/lib/api";
import { money } from "@/lib/pos/money";
import { ReturnCustomerBlock } from "./return-customer-block";

type RefundMethod = "cash" | "card" | "wallet" | "other";
type Allocation = { method: RefundMethod; amount: string; reference: string };

const METHOD_META: Record<RefundMethod, { label: string; icon: React.ReactNode }> = {
  cash: { label: "Efectivo", icon: <Banknote className="size-4" /> },
  card: { label: "Tarjeta", icon: <CreditCard className="size-4" /> },
  wallet: { label: "Wallet", icon: <WalletCards className="size-4" /> },
  other: { label: "Otro medio", icon: <ReceiptText className="size-4" /> },
};

const round2 = (n: number) => Math.round(n * 100) / 100;

const schema = yup.object({
  payments: yup.array().of(yup.object({
    method: yup.string().oneOf(["cash", "card", "wallet", "other"]).required(),
    amount: yup.number().transform((value, original) => original === "" ? undefined : value)
      .typeError("Ingresa un importe válido").moreThan(0, "Debe ser mayor que cero").required("El importe es obligatorio"),
    reference: yup.string().trim().when("method", {
      is: (method: RefundMethod) => method !== "cash",
      then: (value) => value.required("Agrega la referencia o comprobante"),
    }),
  })).required(),
});

function initialAllocations(detail: SaleReturnDetail, target: number): Allocation[] {
  const capacity = new Map<RefundMethod, number>();
  for (const payment of detail.refundAvailability ?? []) {
    capacity.set(payment.method, Number(payment.amount));
  }
  let remaining = target;
  return [...capacity]
    .map(([method, available]) => {
      const amount = Math.min(remaining, available);
      remaining = Math.max(0, round2(remaining - amount));
      return { method, amount: amount > 0 ? amount.toFixed(2) : "", reference: "" };
    })
    .filter((payment) => Number(payment.amount) > 0);
}

/**
 * Entrega al cliente lo que se le debe por una devolución de dinero o por la diferencia a favor de un
 * cambio: en efectivo (sale de la caja), tarjeta u otro medio, y —si el negocio los tiene habilitados—
 * bonificado en puntos o abonado a su crédito.
 */
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
  const [pointsMoney, setPointsMoney] = useState("");
  const [creditMoney, setCreditMoney] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [settlement, setSettlement] = useState<ReturnSettlement | null>(null);

  const due = detail ? round2(detail.settlement?.due ?? Number(detail.total)) : 0;
  const pointsValue = round2(Math.max(0, Number(pointsMoney) || 0));
  const creditValue = round2(Math.max(0, Number(creditMoney) || 0));
  const toDeliver = round2(due - pointsValue - creditValue);

  useEffect(() => {
    if (!open || !detail) return;
    setSettlement(detail.settlement ?? null);
    setPointsMoney("");
    setCreditMoney("");
    setCustomerId("");
    setPayments(initialAllocations(detail, round2(detail.settlement?.due ?? Number(detail.total))));
    setCashSessionId(detail.openCashSessions[0]?.id ?? null);
    setErrors({});
    const frame = requestAnimationFrame(() => focusFirstEnabled(formId));
    return () => cancelAnimationFrame(frame);
  }, [detail, focusFirstEnabled, open]);

  // Cliente asignado a mano: se recarga su saldo de puntos y su adeudo.
  useEffect(() => {
    if (!open || !detail || !customerId) return;
    let cancelled = false;
    salesApi.returnContext(detail.saleId, customerId).then((res) => {
      if (!cancelled && res.ok) setSettlement(res.context);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [customerId, detail, open]);

  // Al cambiar las bonificaciones se reparte de nuevo lo que sí sale en efectivo/tarjeta.
  useEffect(() => {
    if (!detail) return;
    setPayments(toDeliver > 0 ? initialAllocations(detail, toDeliver) : []);
  }, [detail, toDeliver]);

  const allocated = useMemo(
    () => round2(payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)),
    [payments]
  );

  if (!detail) return null;

  const customer = settlement?.customer ?? null;
  const canPoints = Boolean(settlement?.loyaltyEnabled);
  const canCredit = Boolean(settlement?.creditEnabled && customer?.hasCreditAccount && (customer?.creditBalance ?? 0) > 0);
  const wantsBonus = pointsValue > 0 || creditValue > 0;
  const isExchange = detail.returnType === "exchange";

  const submit = async () => {
    const fieldErrors: Record<string, string> = {};
    try {
      if (wantsBonus && !customer) {
        fieldErrors["return-customer"] = "Asigna o registra al cliente";
        throw new yup.ValidationError(fieldErrors["return-customer"], customerId, "return-customer");
      }
      if (creditValue > 0 && customer && creditValue - customer.creditBalance > 0.009) {
        fieldErrors["refund-credit"] = `No puede exceder el adeudo (${money(customer.creditBalance)})`;
        throw new yup.ValidationError(fieldErrors["refund-credit"], creditValue, "refund-credit");
      }
      if (toDeliver < -0.009) {
        fieldErrors.refundTotal = `Las bonificaciones exceden ${money(due)}`;
        throw new yup.ValidationError(fieldErrors.refundTotal, toDeliver, "refundTotal");
      }
      await schema.validate({ payments }, { abortEarly: false });
      if (Math.abs(allocated - Math.max(0, toDeliver)) > 0.009) {
        fieldErrors.refundTotal = `Distribuye exactamente ${money(Math.max(0, toDeliver))}`;
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
      const response = await salesApi.completeReturn(
        detail.id,
        payments.map((payment) => ({
          method: payment.method,
          amount: Number(payment.amount),
          reference: payment.reference.trim() || undefined,
        })),
        cashSessionId ?? undefined,
        {
          pointsAmount: pointsValue || undefined,
          creditAmount: creditValue || undefined,
          customerId: customer && !detail.settlement?.customerAssigned ? customer.id : undefined,
        }
      );
      if (!response.return) throw new Error("El servidor no devolvió la operación completada");
      onCompleted();
      onOpenChange(false);
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : "No se pudo registrar la entrega" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogComponent
      open={open}
      onOpenChange={(next) => !submitting && onOpenChange(next)}
      icon={<RotateCcw className="size-5" />}
      title={isExchange ? "Entregar la diferencia del cambio" : "Registrar entrega del reembolso"}
      description={
        isExchange
          ? `El producto de cambio cuesta menos: ${money(due)} a favor del cliente. Entrégalo desde la caja o bonifícalo.`
          : "Distribuye el total entre los medios usados en la venta. Para tarjeta, wallet u otro medio, captura la referencia del comprobante."
      }
      size="md"
      bodyClassName="space-y-4"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {isExchange ? "Confirmar entrega" : "Confirmar reembolso"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={(event) => { event.preventDefault(); void submit(); }} className="space-y-3">
        {(canPoints || canCredit) && (
          <div className="space-y-3 rounded-xl border bg-card p-3">
            <p className="text-sm font-semibold">Bonificar una parte (opcional)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {canPoints && (
                <InputGroupField
                  id="refund-points"
                  label="En puntos de lealtad"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={pointsMoney}
                  onChange={(event) => setPointsMoney(event.target.value)}
                  helper={pointsValue > 0 ? `${Math.round(pointsValue * (settlement?.pointsPerCurrency ?? 0)).toLocaleString("es-MX")} puntos` : `${settlement?.pointsPerCurrency ?? 1} punto por cada $1`}
                />
              )}
              {canCredit && (
                <InputGroupField
                  id="refund-credit"
                  label="Abonar a su crédito"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={creditMoney}
                  onChange={(event) => setCreditMoney(event.target.value)}
                  error={errors["refund-credit"]}
                  helper={`Adeudo actual ${money(customer?.creditBalance ?? 0)}`}
                />
              )}
            </div>
            <div data-form-field="return-customer">
              <ReturnCustomerBlock
                ctx={settlement}
                saleHasCustomer={Boolean(detail.settlement?.customerAssigned)}
                customerId={customerId}
                onCustomerChange={setCustomerId}
                pointsMoney={pointsValue}
                creditMoney={creditValue}
              />
              {errors["return-customer"] && <p className="mt-1 text-sm text-destructive" role="alert">{errors["return-customer"]}</p>}
            </div>
          </div>
        )}

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
        {payments.length === 0 && toDeliver > 0.009 && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            No hay un medio compatible para entregar {money(toDeliver)}. Bonifica una parte en puntos o crédito.
          </p>
        )}

        <div data-form-field="refundTotal" className="flex items-center justify-between rounded-xl border p-3 text-sm">
          <span className="text-muted-foreground">Entrega en caja o medio de pago</span>
          <span className="font-bold tabular-nums">{money(allocated)} / {money(Math.max(0, toDeliver))}</span>
        </div>
        {errors.refundTotal && <p className="text-sm text-destructive" role="alert">{errors.refundTotal}</p>}
        {errors.form && <p className="text-sm text-destructive" role="alert">{errors.form}</p>}
      </form>
    </DialogComponent>
  );
}
