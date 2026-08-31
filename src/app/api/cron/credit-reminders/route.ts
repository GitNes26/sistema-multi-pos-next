import { NextResponse } from "next/server";
import { checkCreditExpirationReminders, checkOverdueCredits } from "@/lib/credit/reminders";

/**
 * GET /api/cron/credit-reminders
 *
 * Endpoint para cron jobs (Dokploy, Vercel Cron, etc.).
 * Ejecuta diariamente para:
 * 1. Recordar créditos próximos a vencer
 * 2. Alertar créditos ya vencidos
 *
 * Seguridad: En producción, validar un header secreto (CRON_SECRET).
 */
export async function GET(req: Request) {
  // Basic auth check (en producción usar CRON_SECRET)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [reminders, overdue] = await Promise.all([
      checkCreditExpirationReminders(),
      checkOverdueCredits(),
    ]);

    return NextResponse.json({
      ok: true,
      reminders,
      overdue,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[cron/credit-reminders]", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
