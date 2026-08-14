import { NextResponse } from "next/server";
import { processMercadoPagoWebhook } from "@/lib/payments/server";

// FASE 16.2 — Webhook de MercadoPago. La org viaja en ?org= (notification_url).

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const organizationId = url.searchParams.get("org");
  if (!organizationId) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const payload = (await req.json().catch(() => null)) as {
    type?: string;
    data?: { id?: string };
  } | null;
  if (!payload) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const result = await processMercadoPagoWebhook(organizationId, payload);
  return NextResponse.json(result);
}
