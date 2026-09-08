import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  GUEST_ACTIVE_STATUSES,
  phoneCandidates,
  rateLimit,
} from "@/lib/reservations/guest-verification";

export const dynamic = "force-dynamic";

// POST /api/public/reservations/verify — el invitado verifica teléfono + código
// de corto plazo y recibe sus reservaciones activas (sin cuenta, sin sesión).

/** Limita intentos de verificación: 8 por teléfono cada 10 minutos. */
const VERIFY_MAX_ATTEMPTS = 8;
const VERIFY_WINDOW_MS = 10 * 60_000;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawPhone = String(body?.phone ?? "").trim();
    const code = String(body?.code ?? "").trim();
    if (rawPhone.length < 7) {
      return NextResponse.json({ ok: false, error: "Ingresa tu teléfono" }, { status: 400 });
    }
    if (!/^\d{4,8}$/.test(code)) {
      return NextResponse.json({ ok: false, error: "Código inválido" }, { status: 400 });
    }

    if (!rateLimit(`guest-verify:${rawPhone}`, VERIFY_MAX_ATTEMPTS, VERIFY_WINDOW_MS)) {
      return NextResponse.json(
        { ok: false, error: "Demasiados intentos — espera unos minutos" },
        { status: 429 }
      );
    }

    const now = new Date();
    const reservations = await prisma.tableReservation.findMany({
      where: {
        phone: { in: phoneCandidates(rawPhone) },
        customerId: null,
        verifyCode: code,
        verifyCodeExpiresAt: { gt: now },
        status: { in: [...GUEST_ACTIVE_STATUSES] },
        endsAt: { gte: now },
      },
      include: {
        organization: { select: { name: true } },
        table: { select: { id: true, number: true, name: true } },
        room: { select: { name: true } },
      },
      orderBy: { startsAt: "asc" },
    });

    return NextResponse.json({
      ok: true,
      reservations: reservations.map((r) => ({
        id: r.id,
        organizationName: r.organization?.name ?? "",
        guests: r.guests,
        name: r.name,
        startsAt: r.startsAt.toISOString(),
        endsAt: r.endsAt.toISOString(),
        status: r.status,
        tableNumber: r.table?.number ?? null,
        roomName: r.room?.name ?? null,
      })),
    });
  } catch (err) {
    console.error("[public/reservations/verify] POST", err);
    return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 });
  }
}
