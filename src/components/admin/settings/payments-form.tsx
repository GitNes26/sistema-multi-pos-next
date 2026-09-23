"use client";

import { useEffect, useState } from "react";
import * as yup from "yup";
import { AlertCircle, Copy, CreditCard, Globe, KeyRound, RefreshCw, ShieldCheck, TabletSmartphone } from "lucide-react";
import { paymentsApi } from "@/lib/payments/client";
import type { GatewayConfig, GatewayProvider } from "@/lib/payments/server";
import { swalToast } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InputGroupField } from "@/components/base/input-group-field";
import { cn } from "@/lib/utils";
import { useFocusInvalid } from "@/hooks/use-focus-invalid";
import { SwitchField } from "@/components/base/switch-field";
import { FormCombobox, type ComboboxOption } from "@/components/base/form-combobox";

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
  const [terminals, setTerminals] = useState<ComboboxOption[]>([]);
  const [loadingTerminals, setLoadingTerminals] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const { focusFirstEnabled, focusFirstInvalid } = useFocusInvalid();

  useEffect(() => {
    paymentsApi
      .config()
      .then((d) => {
        setConfig(d.config);
        setWebhookUrl(d.webhookUrl);
      })
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
        ? yup.object({ mercadopago: yup.object({
            accessToken: requiredSecret,
            publicKey: requiredSecret,
            webhookSecret: requiredSecret,
            terminalId: yup.string().when("pointEnabled", { is: true, then: (schema) => schema.trim().required("Selecciona una terminal Point") }),
          }) })
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

  const loadTerminals = async () => {
    setLoadingTerminals(true);
    setFormError(undefined);
    try {
      const response = await fetch("/api/settings/payments/mercadopago/terminals");
      const data = await response.json() as { terminals?: Array<{ id: string; externalPosId?: string; operatingMode?: string }>; error?: string };
      if (!response.ok) throw new Error(data.error ?? "No se pudieron consultar las terminales");
      setTerminals((data.terminals ?? []).map((terminal) => ({
        value: terminal.id,
        label: terminal.externalPosId || `Point · ${terminal.id.slice(-8)}`,
        meta: `${terminal.id}${terminal.operatingMode ? ` · ${terminal.operatingMode}` : ""}`,
      })));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "No se pudieron consultar las terminales");
    } finally {
      setLoadingTerminals(false);
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
          <div>
            <p className="text-sm font-semibold">Mercado Pago</p>
            <p className="text-xs text-muted-foreground">Checkout Pro cobra en línea desde el portal. Point envía el importe del POS a una terminal física vinculada.</p>
          </div>
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
          <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
            <p className="text-sm font-medium">URL de notificaciones de esta empresa</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border bg-background px-3 py-2 text-xs">
                {webhookUrl}
              </code>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(webhookUrl);
                  swalToast("URL de notificaciones copiada");
                }}
                disabled={!webhookUrl}
              >
                <Copy className="size-4" /> Copiar URL
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Regístrala en Mercado Pago para los eventos Pagos y Orders/Point.
            </p>
          </div>
          <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
            <SwitchField
              id="payments-mercadopago-pointEnabled"
              label="Cobros presenciales con Point"
              description="Envía el total desde el POS y espera la aprobación de la terminal antes de registrar la venta."
              icon={<TabletSmartphone className="size-4" />}
              checked={config.mercadopago.pointEnabled}
              onCheckedChange={(pointEnabled) => setConfig({ ...config, mercadopago: { ...config.mercadopago, pointEnabled } })}
            />
            {config.mercadopago.pointEnabled && (
              <>
                <FormCombobox
                  id="payments-mercadopago-terminalId"
                  label="Terminal Point"
                  required
                  icon={<TabletSmartphone className="size-4" />}
                  options={terminals.some((terminal) => terminal.value === config.mercadopago.terminalId)
                    ? terminals
                    : config.mercadopago.terminalId
                      ? [{ value: config.mercadopago.terminalId, label: `Point · ${config.mercadopago.terminalId.slice(-8)}`, meta: config.mercadopago.terminalId }, ...terminals]
                      : terminals}
                  value={config.mercadopago.terminalId}
                  onChange={(terminalId) => setConfig({ ...config, mercadopago: { ...config.mercadopago, terminalId } })}
                  placeholder="Consulta y selecciona una terminal"
                  emptyText="No se encontraron terminales vinculadas"
                  loading={loadingTerminals}
                  error={errors["mercadopago.terminalId"]}
                  infoTooltip="La terminal debe iniciar sesión con la misma cuenta propietaria del Access Token."
                />
                <Button type="button" variant="outline" onClick={loadTerminals} disabled={loadingTerminals || !config.mercadopago.accessToken}>
                  <RefreshCw className={cn("size-4", loadingTerminals && "animate-spin")} />
                  {loadingTerminals ? "Consultando…" : "Consultar terminales vinculadas"}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {config.provider !== "none" && (
        <p className="text-xs text-muted-foreground">
          En Mercado Pago usa la URL de notificaciones mostrada arriba. Activa los eventos <strong>Pagos</strong> y <strong>Orders/Point</strong>;<br />
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
