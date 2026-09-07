import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePortalCustomer, portalErrorResponse } from "../guard";

// Reservaciones de mesa desde el portal de clientes: el cliente pide fecha,
// hora y comensales (con o sin mesa concreta) y el anfitrión la confirma.

export const dynamic = "force-dynamic";

// GET /api/portal/reservations — Disponibilidad + salas/mesas del local y las
// reservaciones del cliente. ?date=YYYY-MM-DD&guests=N para filtrar mesas aptas.
export async function GET(req: Request) {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  try {
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date") ?? null;
    const guests = Number(url.searchParams.get("guests") ?? 0);

    const rooms = await prisma.tableRoom.findMany({
      where: { organizationId: guard.organizationId, isActive: true },
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

    // Mesas sin sala también se ofrecen (fallback del plano).
    const looseTables = await prisma.table.findMany({
      where: { organizationId: guard.organizationId, isActive: true, roomId: null },
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

    // Reservas vigentes (pending/confirmed) del día para no sugerir mesas dobles.
    const taken: { tableId: string | null }[] = [];
    if (dateParam) {
      const start = new Date(`${dateParam}T00:00:00.000Z`);
      const end = new Date(`${dateParam}T23:59:59.999Z`);
      taken.push(
        ...(await prisma.tableReservation.findMany({
          where: {
            organizationId: guard.organizationId,
            startsAt: { gte: start, lte: end },
            status: { in: ["pending", "confirmed"] },
          },
          select: { tableId: true },
        }))
      );
    }
    const takenTableIds = new Set(taken.map((t) => t.tableId).filter(Boolean) as string[]);

    const mine = await prisma.tableReservation.findMany({
      where: {
        organizationId: guard.organizationId,
        customerId: guard.customerId,
        status: { in: ["pending", "confirmed", "seated"] },
      },
      include: {
        room: { select: { id: true, name: true } },
        table: { select: { id: true, number: true } },
      },
      orderBy: { startsAt: "asc" },
    });

    return NextResponse.json({
      ok: true,
      rooms,
      looseTables,
      takenTableIds: [...takenTableIds],
      myReservations: mine,
      guests,
    });
  } catch (err) {
    return portalErrorResponse(err);
  }
}

// POST /api/portal/reservations — Crear reservación de mesa.
export async function POST(req: Request) {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  try {
    const input = await req.json();
    const { startsAt, guests, locationId, roomId, tableId, notes } = input;
    const start = new Date(startsAt);
    if (!start || Number.isNaN(start.getTime())) {
      return NextResponse.json({ ok: false, error: "Fecha de reservación requerida" }, { status: 400 });
    }
    const party = Math.max(1, Math.min(Number(guests) || 2, 50));
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // mesa por 2h

    // Si pide mesa concreta: debe existir, caber los comensales y estar libre.
    if (tableId) {
      const table = await prisma.table.findFirst({
        where: { id: tableId, organizationId: guard.organizationId, isActive: true },
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
        organizationId: guard.organizationId,
        locationId: locationId || null,
        roomId: roomId || null,
        tableId: tableId || null,
        customerId: guard.customerId,
        guests: party,
        startsAt: start,
        endsAt: end,
        notes: notes || null,
      },
      include: {
        room: { select: { id: true, name: true } },
        table: { select: { id: true, number: true, name: true } },
      },
    });
    return NextResponse.json({ ok: true, reservation });
  } catch (err) {
    return portalErrorResponse(err);
  }
}