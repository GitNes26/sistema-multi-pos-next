import type { GatewayConfig } from "@/lib/payments/server";

// FASE 16 — Cliente HTTP de pasarelas de pago.

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = (await res.json().catch(() => null)) as T & { error?: string };
  if (!res.ok) throw new Error(data?.error ?? "Error de red");
  return data;
}

export const paymentsApi = {
  config: () => json<{ ok: boolean; config: GatewayConfig }>("/api/settings/payments"),
  updateConfig: (input: Partial<GatewayConfig>) =>
    json<{ ok: boolean; config: GatewayConfig }>("/api/settings/payments", {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  payOrder: (orderId: string) =>
    json<{ ok: boolean; url: string }>(`/api/portal/orders/${orderId}/pay`, {
      method: "POST",
    }),
};
