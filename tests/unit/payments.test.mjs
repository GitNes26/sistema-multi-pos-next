import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyStripeSignature, verifyMercadoPagoSignature, paymentMatches } from "../../src/lib/payments/verification.ts";

const secret = "test-only-signing-secret";
const body = '{"type":"checkout.session.completed"}';
const now = 1789140000000;
const ts = String(now / 1000);
const mac = (message) => createHmac("sha256", secret).update(message).digest("hex");
const signed = `t=${ts},v1=${mac(`${ts}.${body}`)}`;

test("Stripe accepts current signature and any matching key during rotation", () => {
  assert.equal(verifyStripeSignature(body, signed, secret, now), true);
  assert.equal(verifyStripeSignature(body, `${signed},v1=${"0".repeat(64)}`, secret, now), true);
});
test("Stripe rejects missing secret, altered body, expired/future timestamp and malformed hex", () => {
  assert.equal(verifyStripeSignature(body, signed, "", now), false);
  assert.equal(verifyStripeSignature(body + " ", signed, secret, now), false);
  assert.equal(verifyStripeSignature(body, signed, secret, now + 301000), false);
  assert.equal(verifyStripeSignature(body, signed, secret, now - 301000), false);
  assert.equal(verifyStripeSignature(body, signed + "zz", secret, now), false);
  assert.equal(verifyStripeSignature(body, signed + `,t=${ts}`, secret, now), false);
});
test("MercadoPago binds notification ID and request ID to signature", () => {
  const sig = `ts=${ts},v1=${mac(`id:abc123;request-id:req1;ts:${ts};`)}`;
  assert.equal(verifyMercadoPagoSignature("ABC123", "req1", sig, secret), true);
  assert.equal(verifyMercadoPagoSignature("other", "req1", sig, secret), false);
  assert.equal(verifyMercadoPagoSignature("abc123", "req2", sig, secret), false);
  assert.equal(verifyMercadoPagoSignature("abc123", "req1", sig, ""), false);
});
test("payment must match stored amount and currency", () => {
  assert.equal(paymentMatches(123.45, "MXN", 123.45, "mxn"), true);
  for (const amount of [undefined, NaN, Infinity, -1, 1, "123.45"]) assert.equal(paymentMatches(123.45, "MXN", amount, "mxn"), false);
  assert.equal(paymentMatches(123.45, "MXN", 123.45, "USD"), false);
});
