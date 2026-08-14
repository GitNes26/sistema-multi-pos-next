import { NextResponse } from "next/server";
import { getPaymentConfig, updatePaymentConfig } from "@/lib/payments/server";
import { settingsManageGuard, settingsErrorResponse } from "../guard";

// FASE 16.3/16.4 — Configuración de pasarela de pago por empresa.

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await settingsManageGuard();
  if ("response" in guard) return guard.response;

  try {
    const config = await getPaymentConfig(guard.organizationId);
    return NextResponse.json({ ok: true, config });
  } catch (err) {
    return settingsErrorResponse(err);
  }
}

export async function PATCH(req: Request) {
  const guard = await settingsManageGuard();
  if ("response" in guard) return guard.response;

  try {
    const input = await req.json();
    const config = await updatePaymentConfig(guard.organizationId, input);
    return NextResponse.json({ ok: true, config });
  } catch (err) {
    return settingsErrorResponse(err);
  }
}
