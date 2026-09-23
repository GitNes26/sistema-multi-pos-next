import { NextResponse } from "next/server";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { requirePosSession, resolveLocationId } from "../../../helpers";
import { cancelPointPayment, createPointPayment, getPaymentConfig, refreshPointPayment } from "@/lib/payments/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const guard = await requirePosSession();
  if ("response" in guard) return guard.response;
  try {
    const body = (await req.json()) as { amount?: number; locationId?: string };
    const organizationId = effectiveOrgId(guard.session)!;
    const locationId = await resolveLocationId(organizationId, body.locationId);
    const payment = await createPointPayment({ organizationId, locationId, userId: guard.session.user.id, amount: Number(body.amount) });
    return NextResponse.json({ ok: true, payment });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "No se pudo iniciar el cobro Point" }, { status: 400 });
  }
}

export async function GET(req: Request) {
  const guard = await requirePosSession();
  if ("response" in guard) return guard.response;
  try {
    const orderId = new URL(req.url).searchParams.get("orderId");
    const organizationId = effectiveOrgId(guard.session)!;
    if (!orderId) {
      const config = await getPaymentConfig(organizationId);
      return NextResponse.json({ ok: true, available: config.provider === "mercadopago" && config.mercadopago.pointEnabled && Boolean(config.mercadopago.terminalId && config.mercadopago.accessToken) });
    }
    const payment = await refreshPointPayment(organizationId, orderId);
    return NextResponse.json({ ok: true, payment });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "No se pudo consultar el cobro Point" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const guard = await requirePosSession();
  if ("response" in guard) return guard.response;
  try {
    const orderId = new URL(req.url).searchParams.get("orderId");
    if (!orderId) throw new Error("Falta el identificador del cobro");
    await cancelPointPayment(effectiveOrgId(guard.session)!, orderId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "No se pudo cancelar el cobro Point" }, { status: 400 });
  }
}
