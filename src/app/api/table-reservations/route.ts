import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { broadcastTableUpdate } from "@/lib/tables/live";
import { broadcastKdsUpdate } from "@/lib/kds/live";
import { upcomingReservationsByTable } from "@/lib/tables/upcoming";

const DENIED = { ok: false, error: "Permiso requerido: locations.manage" };

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