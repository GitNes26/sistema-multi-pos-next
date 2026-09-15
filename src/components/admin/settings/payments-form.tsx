"use client";

import { useEffect, useState } from "react";
import * as yup from "yup";
import { AlertCircle, CreditCard, Globe, KeyRound, ShieldCheck } from "lucide-react";
import { paymentsApi } from "@/lib/payments/client";
import type { GatewayConfig, GatewayProvider } from "@/lib/payments/server";
import { swalToast } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InputGroupField } from "@/components/base/input-group-field";
import { cn } from "@/lib/utils";
import { useFocusInvalid } from "@/hooks/use-focus-invalid";

const PROVIDERS: { value: GatewayProvider; label: string }[] = [
  { value: "none", label: "Sin pasarela (pago en sucursal)" },
  { value: "stripe", label: "Stripe" },
  { value: "mercadopago", label: "MercadoPago" },
];

export function PaymentsForm() {
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const { focusFirstEnabled, focusFirstInvalid } = useFocusInvalid();

  useEffect(() => {
    paymentsApi
      .config()
      .then((d) => setConfig(d.config))
      .catch(() => setFormError("No se pudo cargar la configuración de pagos"));
  }, []);

  const ready = Boolean(config);
  useEffect(() => {
    if (!ready) return;
    const frame = window.requestAnimationFrame(() => focusFirstEnabled("payments-form"));
    return () => window.cancelAnimationFrame(frame);
  }, [focusFirstEnabled, ready]);

  const save = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!config) return;
    const requiredSecret = yup.string().trim().required("Campo obligatorio");
    const schema = config.provider === "stripe"
      ? yup.object({ stripe: yup.object({ secretKey: requiredSecret, publicKey: requiredSecret, webhookSecret: requiredSecret }) })
      : config.provider === "mercadopago"
        ? yup.object({ mercadopago: yup.object({ accessToken: requiredSecret, publicKey: requiredSecret, webhookSecret: requiredSecret }) })
        : yup.object({});
    try {
      await schema.validate(config, { abortEarly: false });
      setErrors({});
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        const next: Record<string, string> = {};
        for (const failure of error.inner) if (failure.path && !next[failure.path]) next[failure.path] = failure.message;
        setErrors(next);
        const focusErrors = Object.fromEntries(Object.entries(next).map(([key, message]) => [`payments-${key.replace(/\./g, "-")}`, message]));
        window.requestAnimationFrame(() => focusFirstInvalid(focusErrors, "payments-form"));
      }
      return;
    }
    setSaving(true);
    setFormError(undefined);
    try {
      const res = await paymentsApi.updateConfig(config);
      setConfig(res.config);
      swalToast("Configuración de pagos guardada");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  if (!config) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <form id="payments-form" noValidate onSubmit={save} className="space-y-4">
      {formError && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />{formError}
        </div>
      )}
      <fieldset className="space-y-2" data-guide="payments-provider">
        <legend className="flex items-center gap-1.5 text-sm font-medium"><CreditCard className="size-4 text-muted-foreground" />Pasarela de pago</legend>
        <div className="grid gap-2 sm:grid-cols-3">
        {PROVIDERS.map((p) => (
          <button
            key={p.value}
            type="button"
            aria-pressed={config.provider === p.value}
            onClick={() => setConfig({ ...config, provider: p.value })}
            className={cn(
              "cursor-pointer rounded-lg border p-3 text-sm font-medium transition-all hover:-translate-y-0.5 hover:shadow-sm",
              config.provider === p.value
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <CreditCard className="mx-auto mb-1 size-4" />
            {p.label}
          </button>
        ))}
        </div>
      </fieldset>

      {config.provider === "stripe" && (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm font-semibold">Stripe</p>
          <InputGroupField
            id="payments-stripe-secretKey"
            label="Clave secreta"
            helper="sk_live_…"
            type="password"
            leftIcon={<KeyRound className="size-4" />}
            value={config.stripe.secretKey}
            onChange={(e) =>
              setConfig({ ...config, stripe: { ...config.stripe, secretKey: e.target.value } })
            }
            required
            error={errors["stripe.secretKey"]}
          />
          <InputGroupField
            id="payments-stripe-publicKey"
            label="Clave pública"
            helper="pk_live_…"
            leftIcon={<Globe className="size-4" />}
            value={config.stripe.publicKey}
            onChange={(e) =>
              setConfig({ ...config, stripe: { ...config.stripe, publicKey: e.target.value } })
            }
            required
            error={errors["stripe.publicKey"]}
          />
          <InputGroupField
            id="payments-stripe-webhookSecret"
            label="Webhook secret"
            helper="whsec_…"
            type="password"
            leftIcon={<ShieldCheck className="size-4" />}
            value={config.stripe.webhookSecret}
            onChange={(e) =>
              setConfig({ ...config, stripe: { ...config.stripe, webhookSecret: e.target.value } })
            }
            required
            error={errors["stripe.webhookSecret"]}
          />
        </div>
      )}

      {config.provider === "mercadopago" && (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm font-semibold">MercadoPago</p>
          <InputGroupField
            id="payments-mercadopago-accessToken"
            label="Access token"
            helper="APP_USR-…"
            type="password"
            leftIcon={<KeyRound className="size-4" />}
            value={config.mercadopago.accessToken}
            onChange={(e) =>
              setConfig({
                ...config,
                mercadopago: { ...config.mercadopago, accessToken: e.target.value },
              })
            }
            required
            error={errors["mercadopago.accessToken"]}
          />
          <InputGroupField
            id="payments-mercadopago-publicKey"
            label="Clave pública"
            leftIcon={<Globe className="size-4" />}
            value={config.mercadopago.publicKey}
            onChange={(e) =>
              setConfig({
                ...config,
                mercadopago: { ...config.mercadopago, publicKey: e.target.value },
              })
            }
            required
            error={errors["mercadopago.publicKey"]}
          />
          <InputGroupField
            id="payments-mercadopago-webhookSecret"
            label="Webhook secret"
            type="password"
            leftIcon={<ShieldCheck className="size-4" />}
            value={config.mercadopago.webhookSecret}
            onChange={(e) =>
              setConfig({
                ...config,
                mercadopago: { ...config.mercadopago, webhookSecret: e.target.value },
              })
            }
            required
            error={errors["mercadopago.webhookSecret"]}
          />
        </div>
      )}

      {config.provider !== "none" && (
        <p className="text-xs text-muted-foreground">
          El webhook de MercadoPago se envía a{" "}
          <code>/api/payments/webhook/mercadopago?org=&#123;id&#125;</code>; <br />
           el de Stripe a{" "}
          <code>/api/payments/webhook/stripe</code>.
        </p>
      )}

      <Button type="submit" disabled={saving} data-guide="payments-save">
        <CreditCard className="size-4" /> {saving ? "Guardando…" : "Guardar cambios"}
      </Button>
    </form>
  );
}
