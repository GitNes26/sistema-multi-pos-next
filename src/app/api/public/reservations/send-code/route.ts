import { NextResponse } from "next/server";
import {
  GUEST_CODE_TTL_MIN,
  issueGuestVerifyCode,
  rateLimit,
} from "@/lib/reservations/guest-verification";
import { notifyGuestVerificationCode } from "@/lib/notifications/messaging";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/public/reservations/send-code — el invitado pide un código nuevo
// por WhatsApp/SMS (vence en 15 min). Limitado a 3 envíos por teléfono cada
// 10 minutos para evitar abuso del canal de mensajería.

const SEND_MAX = 3;
const SEND_WINDOW_MS = 10 * 60_000;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawPhone = String(body?.phone ?? "").trim();
    if (rawPhone.length < 7) {
      return NextResponse.json({ ok: false, error: "Ingresa tu teléfono" }, { status: 400 });
    }

    if (!rateLimit(`guest-send-code:${rawPhone}`, SEND_MAX, SEND_WINDOW_MS)) {
      return NextResponse.json(
        { ok: false, error: "Demasiados envíos — espera unos minutos" },
        { status: 429 }
      );
    }

    const issued = await issueGuestVerifyCode(rawPhone);
    if (!issued) {
      // No revela si el teléfono existe o no: misma respuesta genérica.
      return NextResponse.json({
        ok: true,
        sent: false,
        message: "No encontramos reservaciones activas para ese teléfono",
      });
    }

    const orgRow = await prisma.tableReservation.findFirst({
      where: { phone: { in: [rawPhone] }, verifyCode: issued.code },
      select: { organization: { select: { name: true } } },
      orderBy: { startsAt: "asc" },
    });

    const result = await notifyGuestVerificationCode({
      phone: rawPhone,
      code: issued.code,
      organizationName: orgRow?.organization?.name ?? null,
      ttlMinutes: GUEST_CODE_TTL_MIN,
    });

    return NextResponse.json({
      ok: true,
      sent: result.sent,
      channel: result.channel,
      message: result.sent
        ? `Código enviado por ${result.channel === "whatsapp" ? "WhatsApp" : "SMS"} — vence en ${GUEST_CODE_TTL_MIN} minutos`
        : "No pudimos enviar el mensaje — usa el código que apareció al reservar",
    });
  } catch (err) {
    console.error("[public/reservations/send-code] POST", err);
    return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 });
  }
}
