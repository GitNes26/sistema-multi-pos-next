import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { broadcastTableUpdate } from "@/lib/tables/live";
import { broadcastKdsUpdate } from "@/lib/kds/live";
import { upcomingReservationsByTable } from "@/lib/tables/upcoming";
import {
  GUEST_ACTIVE_STATUSES,
  phoneCandidates,
  rateLimit,
} from "@/lib/reservations/guest-verification";

export const dynamic = "force-dynamic";

// POST /api/public/reservations/manage — el invitado confirma o cancela su
// reservación sin cuenta con teléfono + código de corto plazo. Re-verifica el
// código en cada acción (el code nunca viaja como "sesión").

const MANAGE_MAX = 12;
const MANAGE_WINDOW_MS = 10 * 60_000;

/** Refresca el aviso de llegada de la mesa en el POS y la tira del KDS. */
async function broadcastReservationChange(organizationId: string, tableId: string | null) {
  if (!tableId) return;
  const upcoming = await upcomingReservationsByTable(organizationId);
  const u = upcoming.get(tableId);
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    include: {
      location: { select: { name: true } },
      room: { select: { id: true, name: true } },
    },
  });
  if (!table) return;
  broadcastTableUpdate(organizationId, {
    id: table.id,
    number: table.number,
    name: table.name,
    capacity: table.capacity,
    status: table.status,
    room: table.room ?? null,
    location: table.location,
    updatedAt: table.updatedAt.toISOString(),
    upcomingReservation: u ? { guests: u.guests, startsAt: u.startsAt.toISOString() } : null,
  });
  broadcastKdsUpdate(organizationId, { type: "reservations_changed" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawPhone = String(body?.phone ?? "").trim();
    const code = String(body?.code ?? "").trim();
    const reservationId = String(body?.reservationId ?? "").trim();
    const action = String(body?.action ?? "").trim();
    if (rawPhone.length < 7 || !/^\d{4,8}$/.test(code) || !reservationId) {
      return NextResponse.json(
        { ok: false, error: "Teléfono, código y reservación requeridos" },
        { status: 400 }
      );
    }
    if (action !== "confirm" && action !== "cancel") {
      return NextResponse.json({ ok: false, error: "Acción inválida" }, { status: 400 });
    }

    if (!rateLimit(`guest-manage:${rawPhone}`, MANAGE_MAX, MANAGE_WINDOW_MS)) {
      return NextResponse.json(
        { ok: false, error: "Demasiados intentos — espera unos minutos" },
        { status: 429 }
      );
    }

    const now = new Date();
    const reservation = await prisma.tableReservation.findFirst({
      where: {
        id: reservationId,
        phone: { in: phoneCandidates(rawPhone) },
        customerId: null,
        verifyCode: code,
        verifyCodeExpiresAt: { gt: now },
        status: { in: [...GUEST_ACTIVE_STATUSES] },
        endsAt: { gte: now },
      },
    });
    if (!reservation) {
      return NextResponse.json(
        { ok: false, error: "Código inválido o vencido — verifica de nuevo" },
        { status: 404 }
      );
    }

    // Confirmar: solo tiene sentido con pendiente. Cancelar: pendiente o confirmada.
    if (action === "confirm" && reservation.status !== "pending") {
      return NextResponse.json({ ok: true, reservation: { id: reservation.id, status: reservation.status } });
    }

    const updated = await prisma.tableReservation.update({
      where: { id: reservation.id },
      data: { status: action === "confirm" ? "confirmed" : "cancelled" },
      select: { id: true, status: true, startsAt: true, guests: true, tableId: true, organizationId: true },
    });

    // La tira del KDS/POS reacciona al cambio (confirmada entra a "próximas";
    // cancelada sale y libera el aviso de la mesa).
    await broadcastReservationChange(updated.organizationId, updated.tableId);

    return NextResponse.json({
      ok: true,
      reservation: { id: updated.id, status: updated.status },
      message:
        action === "confirm"
          ? "Reservación confirmada — te esperamos"
          : "Reservación cancelada",
    });
  } catch (err) {
    console.error("[public/reservations/manage] POST", err);
    return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 });
  }
}
