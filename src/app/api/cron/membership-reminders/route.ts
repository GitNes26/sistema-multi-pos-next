import { NextResponse } from "next/server";
import { sweepMembershipReminders } from "@/lib/loyalty/server";

/**
 * GET /api/cron/membership-reminders
 *
 * Para el cron diario (Dokploy, etc.): avisa en el portal a los clientes cuya membresía vence dentro de los días
 * de aviso que configuró cada negocio. Un aviso por periodo. Protegido con CRON_SECRET cuando está definido.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await sweepMembershipReminders();
    return NextResponse.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[cron/membership-reminders]", err);
    return NextResponse.json({ ok: false, error: "Error al enviar los avisos" }, { status: 500 });
  }
}
