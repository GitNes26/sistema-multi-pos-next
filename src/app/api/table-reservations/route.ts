import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { broadcastTableUpdate } from "@/lib/tables/live";
import { broadcastKdsUpdate } from "@/lib/kds/live";
import { upcomingReservationsByTable, getUpcomingWindowMs } from "@/lib/tables/upcoming";
import { notifyGuestReservationConfirmed } from "@/lib/notifications/messaging";
import {
  getReservationPolicy,
  locationSchedule,
  slotsForDay,
  validatePolicyForCreate,
} from "@/lib/tables/reservations-policy";

const DENIED = { ok: false, error: "Permiso requerido: locations.manage" };

export const dynamic = "force-dynamic";

/** Sesión de app con organización (base común de todos los handlers). */
async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { response: NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 }) };
  }
  const organizationId = effectiveOrgId(session);
  if (!organizationId) {
    return { response: NextResponse.json({ ok: false, error: "Sin organización" }, { status: 403 }) };
  }
  return { session, organizationId };
}

// GET /api/table-reservations — Reservaciones de mesa (anfitrión/gerente).
// Filtros: ?status=, ?locationId=, ?date=YYYY-MM-DD (por startsAt del día).
export async function GET(req: Request) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;
  const { session, organizationId } = guard;

  if (!hasPermission(session, "locations.manage")) {
    return NextResponse.json(DENIED, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const locationId = url.searchParams.get("locationId");
    const date = url.searchParams.get("date");

    const where: Record<string, unknown> = { organizationId };
    if (status) where.status = status;
    if (locationId) where.locationId = locationId;
    if (date) {
      const start = new Date(`${date}T00:00:00.000Z`);
      const end = new Date(`${date}T23:59:59.999Z`);
      where.startsAt = { gte: start, lte: end };
    }

    const reservations = await prisma.tableReservation.findMany({
      where,
      select: {
        id: true,
        guests: true,
        startsAt: true,
        endsAt: true,
        status: true,
        notes: true,
        name: true,
        phone: true,
        location: { select: { id: true, name: true } },
        room: { select: { id: true, name: true } },
        table: { select: { id: true, number: true, name: true, capacity: true } },
        customer: { select: { id: true, fullName: true, phone: true } },
      },
      orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ ok: true, reservations });
  } catch (error) {
    console.error("[table-reservations] GET Error:", error);
    return NextResponse.json({ ok: false, error: "Error al obtener reservaciones" }, { status: 500 });
  }
}

// PATCH /api/table-reservations — Cambiar estado (confirmar/cancelar/sentar).
// Sentar (seated) marca la mesa ocupada en tiempo real (broadcast al POS).
export async function PATCH(req: Request) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;
  const { session, organizationId } = guard;

  if (!hasPermission(session, "locations.manage")) {
    return NextResponse.json(DENIED, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, status, tableId } = body;
    if (!id || !status) {
      return NextResponse.json({ ok: false, error: "id y status requeridos" }, { status: 400 });
    }
    const owned = await prisma.tableReservation.findFirst({
      where: { id, organizationId },
      include: { table: { select: { id: true, number: true } } },
    });
    if (!owned) {
      return NextResponse.json({ ok: false, error: "Reservación no encontrada" }, { status: 404 });
    }

    const reservation = await prisma.tableReservation.update({
      where: { id },
      data: { status, tableId: tableId !== undefined ? tableId : undefined },
      include: {
        table: { select: { id: true, number: true, name: true } },
        room: { select: { id: true, name: true } },
      },
    });

    // Confirmación de invitado (reservación sin cuenta): avisar por WhatsApp/SMS
    // al teléfono que dejó en /reservar. Fire-and-forget: un fallo de
    // mensajería no debe bloquear ni revertir la confirmación del anfitrión.
    if (
      status === "confirmed" &&
      owned.status !== "confirmed" &&
      !owned.customerId &&
      owned.phone
    ) {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      });
      notifyGuestReservationConfirmed({
        guestName: owned.name,
        phone: owned.phone,
        organizationName: org?.name ?? "el restaurante",
        startsAt: owned.startsAt,
        guests: owned.guests,
        tableNumber: reservation.table?.number ?? null,
        roomName: reservation.room?.name ?? null,
      }).catch((err) => {
        console.error("[table-reservations] guest confirmation message failed:", err);
      }); // fire-and-forget, no bloquear la respuesta
    }

    // Campana del KDS: se confirmó una reservación PRÓXIMA (con mesa y hora
    // dentro de la ventana del aviso) → avisar al equipo sin mirar la tira.
    if (
      status === "confirmed" &&
      owned.status !== "confirmed" &&
      reservation.tableId &&
      reservation.table
    ) {
      const windowMs = await getUpcomingWindowMs(organizationId);
      const t = reservation.startsAt.getTime();
      if (t > Date.now() && t <= Date.now() + windowMs) {
        broadcastKdsUpdate(organizationId, {
          type: "reservation_confirmed",
          table: reservation.table,
          startsAt: reservation.startsAt.toISOString(),
          guests: reservation.guests,
          guestName: reservation.name ?? null,
        });
      }
    }

    // Sentar → la mesa pasa a ocupada y se difunde en vivo al POS.
    if (status === "seated" && reservation.tableId) {
      const table = await prisma.table.update({
        where: { id: reservation.tableId },
        data: { status: "occupied" },
        include: {
          location: { select: { name: true } },
          room: { select: { id: true, name: true } },
        },
      });
      broadcastTableUpdate(organizationId, {
        id: table.id,
        number: table.number,
        name: table.name,
        capacity: table.capacity,
        status: table.status,
        room: table.room ?? null,
        location: table.location,
        updatedAt: table.updatedAt.toISOString(),
        upcomingReservation: null, // ya sentaron: ya no es llegada próxima
      });
      broadcastKdsUpdate(organizationId, { type: "reservations_changed" });
    }

    // Confirmar / cancelar / cambiar mesa → refrescar el aviso de llegada de
    // esa mesa en el POS y en la tira del KDS (broadcast ligero, sin tocar
    // el estado de la mesa si no fue "seated").
    if (reservation.tableId && status !== "seated") {
      const upcoming = await upcomingReservationsByTable(organizationId);
      const u = upcoming.get(reservation.tableId);
      const table = await prisma.table.findUnique({
        where: { id: reservation.tableId },
        include: {
          location: { select: { name: true } },
          room: { select: { id: true, name: true } },
        },
      });
      if (table) {
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
    }

    return NextResponse.json({ ok: true, reservation });
  } catch (error) {
    console.error("[table-reservations] PATCH Error:", error);
    return NextResponse.json({ ok: false, error: "Error al actualizar reservación" }, { status: 500 });
  }
}

// POST /api/table-reservations — Crear reservación desde el panel (anfitrión):
// mismo flujo y políticas que portal/invitado, pero el anfitrión captura los
// datos del comensal (nombre/teléfono opcional si es de paso).

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const organizationId = effectiveOrgId(session);
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Sin organización" }, { status: 403 });
  }
  if (!hasPermission(session, "locations.manage")) {
    return NextResponse.json({ ok: false, error: "Permiso requerido: locations.manage" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { startsAt, guests, name, phone, notes, locationId, roomId, tableId } = body;
    const start = new Date(startsAt);
    if (!start || Number.isNaN(start.getTime())) {
      return NextResponse.json({ ok: false, error: "Fecha de reservación requerida" }, { status: 400 });
    }

    const policy = await getReservationPolicy(organizationId);
    const requested = Math.max(1, Number(guests) || 2);
    const party = Math.min(requested, policy.maxGuests);
    const end = new Date(start.getTime() + policy.durationMinutes * 60 * 1000);

    // Políticas (anticipación/ventana/comensales): el panel también las acata.
    // Se valida con los comensales solicitados (rechaza, no recorta).
    const policyCheck = await validatePolicyForCreate({
      organizationId,
      customerId: null,
      startsAt: start,
      guests: requested,
    });
    if (!policyCheck.ok) {
      return NextResponse.json({ ok: false, error: policyCheck.error }, { status: policyCheck.status });
    }

    // Horario de la sucursal: la hora debe caer en un slot reservable.
    const schedule = await locationSchedule(locationId || null);
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

    // Mesa concreta: debe existir, caber los comensales y estar libre ese horario.
    if (tableId) {
      const table = await prisma.table.findFirst({
        where: { id: tableId, organizationId, isActive: true },
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
      const overlapping = await prisma.tableReservation.findFirst({
        where: {
          organizationId,
          tableId,
          status: { in: ["pending", "confirmed", "seated"] },
          startsAt: { lt: end },
          endsAt: { gt: start },
        },
        select: { id: true },
      });
      if (overlapping) {
        return NextResponse.json(
          { ok: false, error: `La mesa #${table.number} ya tiene una reservación en ese horario` },
          { status: 409 }
        );
      }
    }

    const reservation = await prisma.tableReservation.create({
      data: {
        organizationId,
        locationId: locationId || null,
        roomId: roomId || null,
        tableId: tableId || null,
        guests: party,
        name: typeof name === "string" && name.trim() ? name.trim() : null,
        phone: typeof phone === "string" && phone.trim() ? phone.trim() : null,
        // Creada por el anfitrión: confirmada salvo que la política exija flujo.
        status: policy.requireConfirmation ? "pending" : "confirmed",
        startsAt: start,
        endsAt: end,
        notes: typeof notes === "string" && notes.trim() ? notes.trim().slice(0, 300) : null,
      },
      include: {
        room: { select: { id: true, name: true } },
        table: { select: { id: true, number: true, name: true } },
      },
    });

    // Refrescar el aviso de llegada de la mesa en el POS/KDS.
    if (reservation.tableId) {
      const upcoming = await upcomingReservationsByTable(organizationId);
      const u = upcoming.get(reservation.tableId);
      const table = await prisma.table.findUnique({
        where: { id: reservation.tableId },
        include: {
          location: { select: { name: true } },
          room: { select: { id: true, name: true } },
        },
      });
      if (table) {
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
      }
    }

    return NextResponse.json({ ok: true, reservation });
  } catch (error) {
    console.error("[table-reservations POST] Error:", error);
    return NextResponse.json({ ok: false, error: "Error al crear la reservación" }, { status: 500 });
  }
}
