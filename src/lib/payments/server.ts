import { isMercadoPagoPointPaid, paymentMatches, verifyStripeSignature, verifyMercadoPagoSignature } from "./verification";
export { verifyStripeSignature } from "./verification";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { broadcastOrderStatus } from "@/lib/portal/live";
import { notifyOrderEvent } from "@/lib/notifications/events";
import { notifyStaff } from "@/lib/notifications/staff";
import { persistNotification } from "@/lib/notifications/helpers";
import { randomUUID } from "node:crypto";

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
    pointEnabled: boolean;
    terminalId: string;
  };
}

const EMPTY_CONFIG: GatewayConfig = {
  provider: "none",
  stripe: { secretKey: "", publicKey: "", webhookSecret: "" },
  mercadopago: {
    accessToken: "",
    publicKey: "",
    webhookSecret: "",
    pointEnabled: false,
    terminalId: "",
  },
};

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function mercadoPagoWebhookUrl(organizationId: string) {
  const base = (process.env.MERCADOPAGO_WEBHOOK_URL ?? `${appUrl()}/api/payments/webhook/mercadopago`).replace(/\?+$/, "");
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}org=${encodeURIComponent(organizationId)}`;
}

export async function getPaymentConfig(organizationId: string): Promise<GatewayConfig> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { paymentGateway: true },
  });
  const raw = (org?.paymentGateway ?? {}) as Partial<GatewayConfig>;
  const storedMercadoPago: Partial<GatewayConfig["mercadopago"]> = raw.mercadopago ?? {};
  return {
    provider: raw.provider ?? "none",
    stripe: { ...EMPTY_CONFIG.stripe, ...(raw.stripe ?? {}) },
    mercadopago: {
      ...EMPTY_CONFIG.mercadopago,
      ...storedMercadoPago,
      accessToken: storedMercadoPago.accessToken || process.env.MERCADOPAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || "",
      publicKey: storedMercadoPago.publicKey || process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY || process.env.MERCADOPAGO_PUBLIC_KEY || process.env.MP_PUBLIC_KEY || "",
      webhookSecret: storedMercadoPago.webhookSecret || process.env.MERCADOPAGO_WEBHOOK_SECRET || process.env.MP_WEBHOOK_SECRET || "",
    },
  };
}

export interface MercadoPagoTerminal {
  id: string;
  posId?: string;
  storeId?: string;
  externalPosId?: string;
  operatingMode?: string;
}

type PointOrderResponse = {
  id?: string;
  type?: string;
  external_reference?: string;
  status?: string;
  status_detail?: string;
  transactions?: { payments?: Array<{ id?: string; amount?: string; status?: string; status_detail?: string }> };
  message?: string;
  error?: string;
  errors?: Array<{ message?: string; details?: string }>;
};

function mercadoPagoError(data: PointOrderResponse, fallback: string) {
  return data.message ?? data.error ?? data.errors?.map((item) => item.message ?? item.details).filter(Boolean).join(" · ") ?? fallback;
}

export async function listMercadoPagoTerminals(organizationId: string): Promise<MercadoPagoTerminal[]> {
  const config = await getPaymentConfig(organizationId);
  if (!config.mercadopago.accessToken) throw new Error("Access token de Mercado Pago no configurado");
  const res = await fetch("https://api.mercadopago.com/terminals/v1/list?limit=50&offset=0", {
    headers: { Authorization: `Bearer ${config.mercadopago.accessToken}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  const data = (await res.json()) as { data?: { terminals?: Array<Record<string, string>> }; message?: string; error?: string };
  if (!res.ok) throw new Error(data.message ?? data.error ?? "Mercado Pago no pudo consultar las terminales");
  return (data.data?.terminals ?? []).map((terminal) => ({
    id: terminal.id,
    posId: terminal.pos_id,
    storeId: terminal.store_id,
    externalPosId: terminal.external_pos_id,
    operatingMode: terminal.operating_mode,
  }));
}

export async function createPointPayment(input: {
  organizationId: string;
  locationId: string;
  userId: string;
  amount: number;
}): Promise<{ intentId: string; orderId: string; status: string; statusDetail?: string }> {
  const config = await getPaymentConfig(input.organizationId);
  const mp = config.mercadopago;
  if (config.provider !== "mercadopago" || !mp.pointEnabled) throw new Error("Mercado Pago Point no está habilitado");
  if (!mp.accessToken) throw new Error("Access token de Mercado Pago no configurado");
  if (!mp.terminalId) throw new Error("Selecciona una terminal Point en Configuración → Pagos");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("El monto del cobro no es válido");
  const organization = await prisma.organization.findUniqueOrThrow({ where: { id: input.organizationId }, select: { currency: true } });
  const idempotencyKey = randomUUID();
  const externalReference = `pos_${randomUUID().replace(/-/g, "")}`.slice(0, 64);
  const intent = await prisma.pointPaymentIntent.create({ data: {
    organizationId: input.organizationId,
    locationId: input.locationId,
    userId: input.userId,
    externalReference,
    terminalId: mp.terminalId,
    amount: Math.round(input.amount * 100) / 100,
    currency: organization.currency,
  } });
  try {
    const res = await fetch("https://api.mercadopago.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mp.accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        type: "point",
        external_reference: externalReference,
        expiration_time: "PT16M",
        transactions: { payments: [{ amount: input.amount.toFixed(2) }] },
        config: {
          point: { terminal_id: mp.terminalId, print_on_terminal: "no_ticket" },
          payment_method: { default_type: "credit_card" },
        },
        description: "Venta Multi-POS",
      }),
    });
    const data = (await res.json()) as PointOrderResponse;
    if (!res.ok || !data.id) throw new Error(mercadoPagoError(data, "Mercado Pago no pudo enviar el cobro a la terminal"));
    const payment = data.transactions?.payments?.[0];
    await prisma.pointPaymentIntent.update({ where: { id: intent.id }, data: {
      orderId: data.id,
      paymentId: payment?.id,
      status: data.status ?? payment?.status ?? "created",
      statusDetail: data.status_detail ?? payment?.status_detail,
    } });
    return { intentId: intent.id, orderId: data.id, status: data.status ?? "created", statusDetail: data.status_detail };
  } catch (error) {
    await prisma.pointPaymentIntent.update({ where: { id: intent.id }, data: { status: "failed", statusDetail: error instanceof Error ? error.message.slice(0, 190) : "Error" } });
    throw error;
  }
}

function pointIsPaid(data: PointOrderResponse) {
  const payment = data.transactions?.payments?.[0];
  return isMercadoPagoPointPaid(data.status, payment?.status);
}

export async function refreshPointPayment(organizationId: string, orderId: string) {
  const config = await getPaymentConfig(organizationId);
  const intent = await prisma.pointPaymentIntent.findFirst({ where: { organizationId, orderId } });
  if (!intent || !config.mercadopago.accessToken) throw new Error("Cobro Point no encontrado");
  const res = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${config.mercadopago.accessToken}`, "Content-Type": "application/json" }, cache: "no-store",
  });
  const data = (await res.json()) as PointOrderResponse;
  if (!res.ok) throw new Error(mercadoPagoError(data, "No se pudo consultar el cobro Point"));
  const payment = data.transactions?.payments?.[0];
  const paid = pointIsPaid(data);
  await prisma.pointPaymentIntent.update({ where: { id: intent.id }, data: {
    paymentId: payment?.id ?? intent.paymentId,
    status: ["claiming", "reconciled"].includes(intent.status)
      ? intent.status
      : paid ? "paid" : (data.status ?? payment?.status ?? intent.status),
    statusDetail: data.status_detail ?? payment?.status_detail,
    paidAt: paid && !intent.paidAt ? new Date() : intent.paidAt,
  } });
  return { intentId: intent.id, orderId, paymentId: payment?.id, status: paid ? "paid" : (data.status ?? payment?.status ?? intent.status), statusDetail: data.status_detail ?? payment?.status_detail, paid };
}

export async function cancelPointPayment(organizationId: string, orderId: string) {
  const config = await getPaymentConfig(organizationId);
  const intent = await prisma.pointPaymentIntent.findFirst({ where: { organizationId, orderId } });
  if (!intent || !config.mercadopago.accessToken) throw new Error("Cobro Point no encontrado");
  const res = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.mercadopago.accessToken}`, "Content-Type": "application/json", "X-Idempotency-Key": randomUUID() },
  });
  const data = (await res.json()) as PointOrderResponse;
  if (!res.ok) throw new Error(mercadoPagoError(data, "La orden debe cancelarse desde la terminal"));
  await prisma.pointPaymentIntent.update({ where: { id: intent.id }, data: { status: "canceled", statusDetail: data.status_detail ?? "canceled" } });
  return { ok: true };
}

export async function claimPointPayment(organizationId: string, reference: string, amount: number) {
  if (!reference.startsWith("mp_point:")) return null;
  const orderId = reference.slice("mp_point:".length);
  const refreshed = await refreshPointPayment(organizationId, orderId);
  if (!refreshed.paid) throw new Error("El cobro en la terminal Point aún no está aprobado");
  const intent = await prisma.pointPaymentIntent.findFirst({ where: { organizationId, orderId } });
  if (!intent || intent.saleId || Math.round(Number(intent.amount) * 100) !== Math.round(amount * 100)) throw new Error("El cobro Point no coincide o ya fue utilizado");
  const claimed = await prisma.pointPaymentIntent.updateMany({
    where: { id: intent.id, saleId: null, status: "paid" },
    data: { status: "claiming" },
  });
  if (!claimed.count) throw new Error("El cobro Point ya está siendo conciliado con otra venta");
  return intent.id;
}

export async function attachPointPaymentToSale(intentId: string, saleId: string) {
  const result = await prisma.pointPaymentIntent.updateMany({ where: { id: intentId, saleId: null, status: "claiming" }, data: { saleId, status: "reconciled" } });
  if (!result.count) throw new Error("El cobro Point ya fue conciliado con otra venta");
}

export async function releasePointPaymentClaim(intentId: string) {
  await prisma.pointPaymentIntent.updateMany({ where: { id: intentId, saleId: null, status: "claiming" }, data: { status: "paid" } });
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
  if (orderId.startsWith("credit:")) {
    const base = `${appUrl()}/portal/credit`;
    return { success: `${base}?payment=returned`, cancel: `${base}?payment=cancelled` };
  }
  const base = `${appUrl()}/portal/orders/${orderId}`;
  return { success: `${base}?paid=1`, cancel: base };
}

/** Abono en línea: el saldo no cambia hasta que la pasarela confirme el pago. */
export async function createCreditCheckout(organizationId: string, customerId: string, requestedAmount: unknown): Promise<CheckoutResult> {
  const amount = Number(requestedAmount);
  if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount - Math.round(amount * 100) / 100) > 0.0000001) throw new Error("Ingresa un monto válido con hasta dos decimales");
  const [account, customer, organization, config, creditPolicy] = await Promise.all([
    prisma.customerCredit.findFirst({ where: { organizationId, customerId } }),
    prisma.customer.findFirst({ where: { id: customerId, organizationId }, select: { email: true } }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { currency: true } }),
    getPaymentConfig(organizationId),
    prisma.creditPolicy.findUnique({ where: { organizationId }, select: { allowPartialPayments: true } }),
  ]);
  if (!account || !customer || !organization) throw new Error("Cuenta de crédito no encontrada");
  if (config.provider === "none") throw new Error("La empresa aún no configuró pagos en línea");
  const intent = await prisma.$transaction(async (tx) => {
    // Serializa solicitudes del mismo cliente: dos pestañas no pueden abrir
    // simultáneamente dos checkouts sobre el mismo saldo disponible.
    await tx.$queryRaw`SELECT id FROM customer_credits WHERE id = ${account.id} FOR UPDATE`;
    const current = await tx.customerCredit.findUniqueOrThrow({ where: { id: account.id } });
    if (amount > Number(current.currentBalance)) throw new Error("El abono no puede superar el saldo pendiente");
    if (creditPolicy?.allowPartialPayments === false && amount !== Number(current.currentBalance)) throw new Error("La empresa requiere liquidar el saldo completo");
    const pending = await tx.creditPaymentIntent.findFirst({ where: { organizationId, customerId, status: "pending", createdAt: { gte: new Date(Date.now() - 30 * 60_000) } } });
    if (pending) throw new Error("Ya tienes un abono en proceso. Espera su confirmación antes de crear otro");
    return tx.creditPaymentIntent.create({ data: { organizationId, customerId, amount, currency: organization.currency, provider: config.provider } });
  });
  let result: CheckoutResult;
  try {
    result = await createCheckout(organizationId, {
      orderId: `credit:${intent.id}`, orderNumber: 0, amount, currency: organization.currency,
      customerEmail: customer.email,
      items: [{ name: "Abono a cuenta de crédito", quantity: 1, unitPrice: amount }],
    });
  } catch (error) {
    await prisma.creditPaymentIntent.update({ where: { id: intent.id }, data: { status: "failed" } });
    throw error;
  }
  await prisma.creditPaymentIntent.update({ where: { id: intent.id }, data: { externalId: result.externalId } });
  return result;
}

async function markCreditPaymentPaid(organizationId: string, reference: string, provider: "stripe" | "mercadopago", externalId: string | undefined, amount: unknown, currency: unknown): Promise<{ ok: boolean }> {
  if (!reference.startsWith("credit:")) return { ok: false };
  const id = reference.slice(7);
  const intent = await prisma.creditPaymentIntent.findFirst({ where: { id, organizationId, provider } });
  if (!intent || !paymentMatches(Number(intent.amount), intent.currency, amount, currency)) return { ok: false };
  if (provider === "stripe" && intent.externalId && externalId !== intent.externalId) return { ok: false };
  if (intent.status === "paid" || intent.status === "paid_review") return { ok: true };
  if (intent.status !== "pending") return { ok: false };
  let outcome: "paid" | "paid_review" | null = null;
  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.creditPaymentIntent.updateMany({ where: { id, status: "pending" }, data: { status: "processing" } });
    if (!claimed.count) return { ok: true };
    const account = await tx.customerCredit.findFirst({ where: { organizationId, customerId: intent.customerId } });
    if (!account || Number(account.currentBalance) < Number(intent.amount)) {
      await tx.creditPaymentIntent.update({ where: { id }, data: { status: "paid_review", paidAt: new Date() } });
      outcome = "paid_review";
      return { ok: true };
    }
    const updated = await tx.customerCredit.updateMany({
      where: { id: account.id, currentBalance: { gte: intent.amount } },
      data: { currentBalance: { decrement: intent.amount } },
    });
    if (!updated.count) {
      await tx.creditPaymentIntent.update({ where: { id }, data: { status: "paid_review", paidAt: new Date() } });
      outcome = "paid_review";
      return { ok: true };
    }
    const balanceAfter = Number(account.currentBalance) - Number(intent.amount);
    if (balanceAfter === 0) await tx.customerCredit.update({ where: { id: account.id }, data: { status: "settled" } });
    await tx.creditTransaction.create({ data: {
      creditId: account.id, customerId: intent.customerId, organizationId,
      type: "payment", amount: intent.amount, balanceAfter,
      description: "Abono confirmado por pasarela", referenceType: provider, referenceId: externalId ?? id, paidAt: new Date(),
    } });
    await tx.creditPaymentIntent.update({ where: { id }, data: { status: "paid", paidAt: new Date() } });
    outcome = "paid";
    return { ok: true };
  });
  if (outcome) {
    await notifyStaff(organizationId, "orders.view", { kind: "credit_payment", title: outcome === "paid" ? "Abono a crédito confirmado" : "Abono requiere conciliación", body: `$${Number(intent.amount).toFixed(2)} recibido`, link: "/admin/credits", severity: outcome === "paid" ? "success" : "warning" }).catch((error) => console.error("[credit/notification]", error));
    const customer = await prisma.customer.findUnique({ where: { id: intent.customerId }, select: { userId: true } });
    if (customer) await persistNotification({ organizationId, userId: customer.userId, recipientUserId: customer.userId, kind: "credit_payment", title: outcome === "paid" ? "Abono confirmado" : "Abono en revisión", body: outcome === "paid" ? `Tu abono de $${Number(intent.amount).toFixed(2)} ya se reflejó en tu saldo.` : "Recibimos el pago y el comercio está conciliando tu saldo.", link: "/portal/credit", severity: outcome === "paid" ? "success" : "warning" }).catch((error) => console.error("[credit/notification]", error));
  }
  return result;
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
      notification_url: mercadoPagoWebhookUrl(organizationId),
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
  event: { type?: string; data?: { object?: { id?: string; client_reference_id?: string; payment_status?: string; amount_total?: number; currency?: string } } }
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
  if (orderId.startsWith("credit:")) return markCreditPaymentPaid(organizationId, orderId, "stripe", object.id, typeof object.amount_total === "number" ? object.amount_total / 100 : undefined, object.currency);
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

  // La API unificada de Point notifica el tópico `order`. La intención ya
  // existe en nuestra BD, por lo que refrescarla deja el cobro conciliable
  // incluso si el navegador del POS se cerró después de la aprobación.
  if (payload.type === "order") {
    const intent = await prisma.pointPaymentIntent.findFirst({ where: { organizationId, orderId: String(paymentId) } });
    if (!intent) return { ok: true };
    await refreshPointPayment(organizationId, String(paymentId));
    return { ok: true };
  }

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${config.mercadopago.accessToken}` },
  });
  const data = (await res.json()) as { status?: string; external_reference?: string; transaction_amount?: number; currency_id?: string };
  if (!res.ok) throw new Error("MercadoPago no pudo verificar el pago");
  if (data.status !== "approved") return { ok: true };
  if (!data.external_reference) return { ok: true };

  if (data.external_reference.startsWith("credit:")) return markCreditPaymentPaid(organizationId, data.external_reference, "mercadopago", String(paymentId), data.transaction_amount, data.currency_id);
  return markOrderPaid(organizationId, data.external_reference, data.transaction_amount, data.currency_id);
}
