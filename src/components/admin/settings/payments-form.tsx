"use client";

import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { paymentsApi } from "@/lib/payments/client";
import type { GatewayConfig, GatewayProvider } from "@/lib/payments/server";
import { swalError, swalToast } from "@/lib/swal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const PROVIDERS: { value: GatewayProvider; label: string }[] = [
  { value: "none", label: "Sin pasarela (pago en sucursal)" },
  { value: "stripe", label: "Stripe" },
  { value: "mercadopago", label: "MercadoPago" },
];

export function PaymentsForm() {
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    paymentsApi
      .config()
      .then((d) => setConfig(d.config))
      .catch(() => undefined);
  }, []);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await paymentsApi.updateConfig(config);
      setConfig(res.config);
      swalToast("Configuración de pagos guardada");
    } catch (err) {
      swalError("No se pudo guardar", err instanceof Error ? err.message : undefined);
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
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        {PROVIDERS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setConfig({ ...config, provider: p.value })}
            className={cn(
              "rounded-lg border p-3 text-sm font-medium transition-colors",
              config.provider === p.value
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {config.provider === "stripe" && (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm font-semibold">Stripe</p>
          <Field label="Clave secreta (sk_live_…)">
            <Input
              type="password"
              value={config.stripe.secretKey}
              onChange={(e) =>
                setConfig({ ...config, stripe: { ...config.stripe, secretKey: e.target.value } })
              }
            />
          </Field>
          <Field label="Clave pública (pk_live_…)">
            <Input
              value={config.stripe.publicKey}
              onChange={(e) =>
                setConfig({ ...config, stripe: { ...config.stripe, publicKey: e.target.value } })
              }
            />
          </Field>
          <Field label="Webhook secret (whsec_…)">
            <Input
              type="password"
              value={config.stripe.webhookSecret}
              onChange={(e) =>
                setConfig({ ...config, stripe: { ...config.stripe, webhookSecret: e.target.value } })
              }
            />
          </Field>
        </div>
      )}

      {config.provider === "mercadopago" && (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm font-semibold">MercadoPago</p>
          <Field label="Access token (APP_USR-…)">
            <Input
              type="password"
              value={config.mercadopago.accessToken}
              onChange={(e) =>
                setConfig({
                  ...config,
                  mercadopago: { ...config.mercadopago, accessToken: e.target.value },
                })
              }
            />
          </Field>
          <Field label="Clave pública">
            <Input
              value={config.mercadopago.publicKey}
              onChange={(e) =>
                setConfig({
                  ...config,
                  mercadopago: { ...config.mercadopago, publicKey: e.target.value },
                })
              }
            />
          </Field>
          <Field label="Webhook secret">
            <Input
              type="password"
              value={config.mercadopago.webhookSecret}
              onChange={(e) =>
                setConfig({
                  ...config,
                  mercadopago: { ...config.mercadopago, webhookSecret: e.target.value },
                })
              }
            />
          </Field>
        </div>
      )}

      {config.provider !== "none" && (
        <p className="text-xs text-muted-foreground">
          El webhook de MercadoPago se envía a{" "}
          <code>/api/payments/webhook/mercadopago?org=&#123;id&#125;</code>; el de Stripe a{" "}
          <code>/api/payments/webhook/stripe</code>.
        </p>
      )}

      <Button onClick={save} disabled={saving}>
        <CreditCard className="size-4" /> {saving ? "Guardando…" : "Guardar cambios"}
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
