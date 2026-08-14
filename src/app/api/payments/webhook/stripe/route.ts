import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processStripeWebhook } from "@/lib/payments/server";

// FASE 16.1 — Webhook de Stripe. La organización se resuelve desde el pedido.

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event: { type?: string; data?: { object?: { client_reference_id?: string; payment_status?: string } } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const orderId = event?.data?.object?.client_reference_id;
  if (!orderId) {
    return NextResponse.json({ ok: true });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { organizationId: true },
  });
  if (!order) {
    return NextResponse.json({ ok: true });
  }

  const result = await processStripeWebhook(order.organizationId, rawBody, signature, event);
  return NextResponse.json(result);
}
