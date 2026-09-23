import { createHmac, timingSafeEqual } from "node:crypto";

function matchesHex(expected: Buffer, signature: string) {
  return /^[a-f0-9]{64}$/i.test(signature) && timingSafeEqual(expected, Buffer.from(signature, "hex"));
}

export function verifyStripeSignature(body: string, header: string | null, secret: string, now = Date.now()): boolean {
  if (!header || !secret) return false;
  const parts = header.split(",").map((part) => part.trim().split("="));
  const timestamps = parts.filter(([key]) => key === "t");
  const timestamp = timestamps[0]?.[1];
  if (timestamps.length !== 1 || !timestamp || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest();
  return parts.some(([key, value]) => key === "v1" && matchesHex(expected, value ?? ""));
}

export function verifyMercadoPagoSignature(dataId: string, requestId: string | null, header: string | null, secret: string): boolean {
  if (!dataId || !requestId || !header || !secret) return false;
  const parts = header.split(",").map((part) => part.trim().split("="));
  const timestamps = parts.filter(([key]) => key === "ts");
  const timestamp = timestamps[0]?.[1];
  if (timestamps.length !== 1 || !timestamp || !/^\d+$/.test(timestamp)) return false;
  const expected = createHmac("sha256", secret)
    .update(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${timestamp};`).digest();
  return parts.some(([key, value]) => key === "v1" && matchesHex(expected, value ?? ""));
}

export function paymentMatches(expected: number, currency: string, amount: unknown, paidCurrency: unknown): boolean {
  return typeof amount === "number" && Number.isFinite(amount) && amount >= 0 &&
    Math.round(expected * 100) === Math.round(amount * 100) &&
    typeof paidCurrency === "string" && currency.toUpperCase() === paidCurrency.toUpperCase();
}

export function isMercadoPagoPointPaid(orderStatus: unknown, paymentStatus: unknown): boolean {
  return [orderStatus, paymentStatus].some((status) => status === "processed" || status === "approved");
}
