import { NextResponse } from "next/server";
import { runAutoRenewals } from "@/lib/loyalty/billing";

/**
 * GET /api/cron/membership-billing
 *
 * Renovaciones automáticas de membresías (opcionales): pide el enlace de pago de la cuota a quien ya toca (por el proveedor de
 * pagos en línea de la empresa) y caduca los enlaces sin pagar. Sin desbloqueo de la plataforma o sin pasarela no hace nada.
 * Correrlo a diario. Protegido con CRON_SECRET.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await runAutoRenewals()), timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[cron/membership-billing]", err);
    return NextResponse.json({ ok: false, error: "Error al procesar las renovaciones" }, { status: 500 });
  }
}
