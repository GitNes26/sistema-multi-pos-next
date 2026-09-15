import { paymentMatches, verifyStripeSignature, verifyMercadoPagoSignature } from "./verification";
export { verifyStripeSignature } from "./verification";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { broadcastOrderStatus } from "@/lib/portal/live";
import { notifyOrderEvent } from "@/lib/notifications/events";

// FASE 16 — Pasarelas de pago (Stripe + MercadoPago).
// Estructura y lógica; las claves se configuran por empresa en /admin/settings/payments.

export type GatewayProvider = "none" | "stripe" | "mercadopago";

export interface GatewayConfig {
  provider: GatewayProvider;
  stripe: {
    secretKey: string;
    publicKey: string;
    webhookSecret: string;
  };
  mercadopago: {
    accessToken: string;
    publicKey: string;
    webhookSecret: string;
  };
}

const EMPTY_CONFIG: GatewayConfig = {
  provider: "none",
  stripe: { secretKey: "", publicKey: "", webhookSecret: "" },
  mercadopago: { accessToken: "", publicKey: "", webhookSecret: "" },
};

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export async function getPaymentConfig(organizationId: string): Promise<GatewayConfig> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { paymentGateway: true },
  });
  const raw = (org?.paymentGateway ?? {}) as Partial<GatewayConfig>;
  return {
    provider: raw.provider ?? "none",
    stripe: { ...EMPTY_CONFIG.stripe, ...(raw.stripe ?? {}) },
    mercadopago: { ...EMPTY_CONFIG.mercadopago, ...(raw.mercadopago ?? {}) },
  };
}

export async function updatePaymentConfig(
  organizationId: string,
  input: Partial<GatewayConfig> & {
    stripe?: Partial<GatewayConfig["stripe"]>;
    mercadopago?: Partial<GatewayConfig["mercadopago"]>;
  }
): Promise<GatewayConfig> {
  const current = await getPaymentConfig(organizationId);
  const next: GatewayConfig = {
    provider: input.provider ?? current.provider,
    stripe: { ...current.stripe, ...(input.stripe ?? {}) },
    mercadopago: { ...current.mercadopago, ...(input.mercadopago ?? {}) },
  };
  await prisma.organization.update({
    where: { id: organizationId },
    data: { paymentGateway: next as unknown as Prisma.InputJsonValue },
  });
  return next;
}

// ── Checkout ─────────────────────────────────────────────────────────────────

export interface CheckoutLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateCheckoutInput {
  orderId: string;
  orderNumber: number;
  amount: number;
  currency: string;
  customerEmail: string | null;
  items: CheckoutLineItem[];
}

export interface CheckoutResult {
  url: string;
  externalId: string;
}

export async function createCheckout(
  organizationId: string,
  input: CreateCheckoutInput
): Promise<CheckoutResult> {
  const config = await getPaymentConfig(organizationId);

  if (config.provider === "stripe") {
    return createStripeSession(config, input);
  }
  if (config.provider === "mercadopago") {
    return createMercadoPagoPreference(config, input, organizationId);
  }
  throw new Error("No hay pasarela de pago configurada");
}

function gateBaseUrls(orderId: string) {
  const base = `${appUrl()}/portal/orders/${orderId}`;
  return { success: `${base}?paid=1`, cancel: base };
}

async function createStripeSession(
  config: GatewayConfig,
  input: CreateCheckoutInput
): Promise<CheckoutResult> {
  if (!config.stripe.secretKey) throw new Error("Clave secreta de Stripe no configurada");
  const { success, cancel } = gateBaseUrls(input.orderId);

  const params = new URLSearchParams({
    mode: "payment",
    success_url: success,
    cancel_url: cancel,
    client_reference_id: input.orderId,
    "metadata[orderId]": input.orderId,
    "metadata[orderNumber]": String(input.orderNumber),
  });
  if (input.customerEmail) params.set("customer_email", input.customerEmail);
  input.items.forEach((it, i) => {
    params.append(`line_items[${i}][quantity]`, String(it.quantity));
    params.append(`line_items[${i}][price_data][currency]`, input.currency.toLowerCase());
    params.append(`line_items[${i}][price_data][unit_amount]`, String(Math.round(it.unitPrice * 100)));
    params.append(`line_items[${i}][price_data][product_data][name]`, it.name);
  });

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.stripe.secretKey}` },
    body: params,
  });
  const data = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!res.ok || !data.url || !data.id) {
    throw new Error(data.error?.message ?? "Stripe no pudo crear la sesión");
  }
  return { url: data.url, externalId: data.id };
}

async function createMercadoPagoPreference(
  config: GatewayConfig,
  input: CreateCheckoutInput,
  organizationId: string
): Promise<CheckoutResult> {
  if (!config.mercadopago.accessToken) throw new Error("Access token de MercadoPago no configurado");
  const { success, cancel } = gateBaseUrls(input.orderId);

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.mercadopago.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: input.items.map((it) => ({
        title: it.name,
        quantity: it.quantity,
        unit_price: it.unitPrice,
        currency_id: input.currency,
      })),
      external_reference: input.orderId,
      notification_url: `${appUrl()}/api/payments/webhook/mercadopago?org=${organizationId}`,
      back_urls: { success, failure: cancel, pending: cancel },
      auto_return: "approved",
    }),
  });
  const data = (await res.json()) as {
    id?: string;
    init_point?: string;
    message?: string;
    error?: string;
  };
  if (!res.ok || !data.init_point || !data.id) {
    throw new Error(data.message ?? data.error ?? "MercadoPago no pudo crear la preferencia");
  }
  return { url: data.init_point, externalId: data.id };
}

// ── Webhooks ─────────────────────────────────────────────────────────────────

async function orderToCheckoutLines(orderId: string): Promise<CreateCheckoutInput> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, customer: { select: { email: true } }, organization: { select: { currency: true } } },
  });
  if (!order) throw new Error("Pedido no encontrado");
  return {
    orderId: order.id,
    orderNumber: Number(order.orderNumber),
    amount: Number(order.total),
    currency: order.organization.currency,
    customerEmail: order.customer?.email ?? null,
    // El total persistido incluye descuentos, impuestos, envío y puntos.
    // Una línea de cobro evita omitir esos ajustes y cantidades fraccionarias
    // incompatibles con Checkout. El detalle permanece en el pedido/ticket.
    items: [{ name: `Pedido #${order.orderNumber}`, quantity: 1, unitPrice: Number(order.total) }],
  };
}

/** Marca el pedido como pagado: pending → confirmed + SSE + notificación. */
export async function markOrderPaid(organizationId: string, orderId: string, amount: unknown, currency: unknown): Promise<{ ok: boolean }> {
  const order = await prisma.order.findFirst({ where: { id: orderId, organizationId }, include: { organization: { select: { currency: true } } } });
  if (!order) return { ok: false };
  if (!paymentMatches(Number(order.total), order.organization.currency, amount, currency)) return { ok: false };
  if (order.paidAt) return { ok: true };
  if (order.status !== "pending") return { ok: false };

  const changed = await prisma.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
      where: { id: orderId, organizationId, status: "pending", paidAt: null, total: order.total },
      data: { status: "confirmed", paidAt: new Date() },
    });
    if (!result.count) return false;
    await tx.orderStatusHistory.create({ data: { orderId, status: "confirmed", notes: "Pago confirmado" } });
    return true;
  });
  if (!changed) {
    const current = await prisma.order.findFirst({ where: { id: orderId, organizationId }, select: { paidAt: true } });
    return { ok: Boolean(current?.paidAt) };
  }

  broadcastOrderStatus({
    orderId,
    orderNumber: Number(order.orderNumber),
    status: "confirmed",
    updatedAt: new Date().toISOString(),
  });
  await notifyOrderEvent(order.organizationId, order.locationId, {}, {
    id: orderId,
    orderNumber: Number(order.orderNumber),
    status: "confirmed",
    customerName: (await prisma.customer.findUnique({ where: { id: order.customerId ?? "" } }))?.fullName ?? null,
    total: Number(order.total),
  }).catch((error: unknown) => console.error("[payments/notification]", error));

  return { ok: true };
}

export async function createOrderCheckout(orderId: string): Promise<CheckoutResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Pedido no encontrado");
  if (order.status !== "pending" || order.paidAt) throw new Error("El pedido ya no admite un nuevo pago");
  if (Number(order.total) <= 0) throw new Error("El pedido no tiene un importe pendiente de pago");
  return createCheckout(order.organizationId, await orderToCheckoutLines(orderId));
}

/** Procesa un webhook de Stripe: verifica firma y, si fue pagado, marca el pedido. */
export async function processStripeWebhook(
  organizationId: string,
  rawBody: string,
  signature: string | null,
  event: { type?: string; data?: { object?: { client_reference_id?: string; payment_status?: string; amount_total?: number; currency?: string } } }
): Promise<{ ok: boolean }> {
  const config = await getPaymentConfig(organizationId);
  if (config.provider !== "stripe" || !verifyStripeSignature(rawBody, signature, config.stripe.webhookSecret)) {
    return { ok: false };
  }
  if (event.type !== "checkout.session.completed") return { ok: true };
  const paymentStatus = event.data?.object?.payment_status;
  const orderId = event.data?.object?.client_reference_id;
  if (!orderId || paymentStatus !== "paid") return { ok: true };
  const object = event.data!.object!;
  return markOrderPaid(organizationId, orderId, typeof object.amount_total === "number" ? object.amount_total / 100 : undefined, object.currency);
}

/** Procesa un webhook de MercadoPago: consulta el pago y, si fue aprobado, marca el pedido. */
export async function processMercadoPagoWebhook(
  organizationId: string,
  payload: { type?: string; data?: { id?: string } },
  headers: { signature: string | null; requestId: string | null; dataId: string | null }
): Promise<{ ok: boolean }> {
  const paymentId = payload.data?.id;
  if (!paymentId) return { ok: false };

  const config = await getPaymentConfig(organizationId);
  if (config.provider !== "mercadopago" || !config.mercadopago.accessToken ||
      headers.dataId !== String(paymentId) ||
      !verifyMercadoPagoSignature(headers.dataId, headers.requestId, headers.signature, config.mercadopago.webhookSecret)) return { ok: false };

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${config.mercadopago.accessToken}` },
  });
  const data = (await res.json()) as { status?: string; external_reference?: string; transaction_amount?: number; currency_id?: string };
  if (!res.ok) throw new Error("MercadoPago no pudo verificar el pago");
  if (data.status !== "approved") return { ok: true };
  if (!data.external_reference) return { ok: true };

  return markOrderPaid(organizationId, data.external_reference, data.transaction_amount, data.currency_id);
}
