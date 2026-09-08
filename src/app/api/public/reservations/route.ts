import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolvePublicOrg } from "@/lib/tables/public-org";
import { GUEST_CODE_TTL_MIN, generateVerifyCode, verifyCodeExpiry } from "@/lib/reservations/guest-verification";
import { normalizePhoneToE164, notifyGuestVerificationCode } from "@/lib/notifications/messaging";
import {
  getReservationPolicy,
  locationSchedule,
  slotsForDay,
  validatePolicyForCreate,
} from "@/lib/tables/reservations-policy";

// Reservaciones de mesa SIN cuenta: el comensal da nombre y teléfono y el
// anfitrión confirma. Ruta pública (no requiere sesión de portal) — la
// organización se resuelve desde `?org=` o desde el par mesa+token del QR
// (`?table=&token=`), igual que el menú digital.

export const dynamic = "force-dynamic";

/** Disponibilidad de salas/mesas para una fecha y comensales (sin "mis reservas"). */
async function availability(organizationId: string, dateParam: string | null, guests: number) {
  const rooms = await prisma.tableRoom.findMany({
    where: { organizationId, isActive: true },
    include: {
      location: { select: { id: true, name: true } },
      tables: {
        where: { isActive: true },
        select: {
          id: true,
          number: true,
          name: true,
          capacity: true,
          shape: true,
          width: true,
          height: true,
          posX: true,
          posY: true,
          status: true,
        },
        orderBy: { number: "asc" },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const looseTables = await prisma.table.findMany({
    where: { organizationId, isActive: true, roomId: null },
    select: {
      id: true,
      number: true,
      name: true,
      capacity: true,
      shape: true,
      width: true,
      height: true,
      posX: true,
      posY: true,
      status: true,
    },
    orderBy: { number: "asc" },
  });

  const takenTableIds: string[] = [];
  if (dateParam) {
    const start = new Date(`${dateParam}T00:00:00.000Z`);
    const end = new Date(`${dateParam}T23:59:59.999Z`);
    const taken = await prisma.tableReservation.findMany({
      where: {
        organizationId,
        startsAt: { gte: start, lte: end },
        status: { in: ["pending", "confirmed"] },
      },
      select: { tableId: true },
    });
    takenTableIds.push(...(taken.map((t) => t.tableId).filter(Boolean) as string[]));
  }

  return { rooms, looseTables, takenTableIds, guests };
}

// GET /api/public/reservations — Disponibilidad pública para el plano.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const org = await resolvePublicOrg(url);
    if ("error" in org) {
      return NextResponse.json({ ok: false, error: org.error }, { status: org.status });
    }
    const dateParam = url.searchParams.get("date");
    const guests = Number(url.searchParams.get("guests") ?? 0);
    const data = await availability(org.organizationId, dateParam, guests);
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    console.error("[public/reservations] GET", err);
    return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 });
  }
}

// POST /api/public/reservations — Crear reservación sin cuenta (nombre+teléfono).
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const org = await resolvePublicOrg(url);
    if ("error" in org) {
      return NextResponse.json({ ok: false, error: org.error }, { status: org.status });
    }

    const input = await req.json();
    const { name, phone, startsAt, guests, locationId, roomId, tableId, notes } = input;

    const guestName = String(name ?? "").trim();
    const guestPhone = String(phone ?? "").trim();
    if (guestName.length < 2) {
      return NextResponse.json({ ok: false, error: "Ingresa tu nombre" }, { status: 400 });
    }
    if (guestPhone.length < 7) {
      return NextResponse.json({ ok: false, error: "Ingresa un teléfono válido" }, { status: 400 });
    }

    const start = new Date(startsAt);
    if (!start || Number.isNaN(start.getTime())) {
      return NextResponse.json({ ok: false, error: "Fecha de reservación requerida" }, { status: 400 });
    }
    const policy = await getReservationPolicy(org.organizationId);
    const requested = Math.max(1, Number(guests) || 2);
    const party = Math.min(requested, policy.maxGuests);
    const end = new Date(start.getTime() + policy.durationMinutes * 60 * 1000);

    // Políticas de reservación: anticipación, ventana y comensales (invitado
    // no tiene customerId: el tope diario no aplica). Se valida con los
    // comensales solicitados (rechaza, no recorta).
    const policyCheck = await validatePolicyForCreate({
      organizationId: org.organizationId,
      customerId: null,
      startsAt: start,
      guests: requested,
    });
    if (!policyCheck.ok) {
      return NextResponse.json({ ok: false, error: policyCheck.error }, { status: policyCheck.status });
    }

    // Horario de la sucursal: la hora debe caer en un slot reservable.
    const schedule = await locationSchedule(locationId || org.locationId || null);
    if (schedule) {
      const ymd = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
      const validSlots = slotsForDay(policy, schedule, ymd);
      const hm = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
      if (!validSlots.includes(hm)) {
        return NextResponse.json(
          { ok: false, error: "La sucursal no recibe reservaciones a esa hora" },
          { status: 400 }
        );
      }
    }

    // Teléfono normalizado (E.164) y código de corto plazo: el invitado
    // confirma/cancela desde /reservar/verificar con teléfono + código.
    const phoneToStore = normalizePhoneToE164(guestPhone) ?? guestPhone;
    const verifyCode = generateVerifyCode();
    const verifyCodeExpiresAt = verifyCodeExpiry();

    // Si pide mesa concreta: debe existir, caber los comensales y estar libre.
    if (tableId) {
      const table = await prisma.table.findFirst({
        where: { id: tableId, organizationId: org.organizationId, isActive: true },
      });
      if (!table) {
        return NextResponse.json({ ok: false, error: "Mesa no disponible" }, { status: 404 });
      }
      if (table.capacity < party) {
        return NextResponse.json(
          { ok: false, error: `La mesa #${table.number} es para ${table.capacity} personas` },
          { status: 400 }
        );
      }
      if (table.status === "occupied") {
        return NextResponse.json(
          { ok: false, error: `La mesa #${table.number} está ocupada en este momento` },
          { status: 409 }
        );
      }
    }

    const reservation = await prisma.tableReservation.create({
      data: {
        organizationId: org.organizationId,
        locationId: locationId || org.locationId || null,
        roomId: roomId || null,
        tableId: tableId || null,
        customerId: null, // reservación de invitado, sin cuenta
        guests: party,
        name: guestName,
        phone: phoneToStore,
        // La política define si el anfitrión confirma o nace confirmada.
        status: policy.requireConfirmation ? "pending" : "confirmed",
        startsAt: start,
        endsAt: end,
        notes: notes || "Reservación sin cuenta (invitado)",
        verifyCode,
        verifyCodeExpiresAt,
      },
      include: {
        room: { select: { id: true, name: true } },
        table: { select: { id: true, number: true, name: true } },
      },
    });

    // El código también viaja por WhatsApp/SMS (fire-and-forget; el código
    // ya se mostró en pantalla, así que un fallo de mensajería no bloquea).
    if (reservation.verifyCode) {
      const orgRow = await prisma.organization.findUnique({
        where: { id: org.organizationId },
        select: { name: true },
      });
      notifyGuestVerificationCode({
        phone: phoneToStore,
        code: reservation.verifyCode,
        organizationName: orgRow?.name ?? null,
        ttlMinutes: GUEST_CODE_TTL_MIN,
      }).catch((err) => {
        console.error("[public/reservations] verify code message failed:", err);
      });
    }

    return NextResponse.json({ ok: true, reservation });
  } catch (err) {
    console.error("[public/reservations] POST", err);
    return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 });
  }
}