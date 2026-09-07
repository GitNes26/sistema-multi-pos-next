import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Reservaciones de mesa SIN cuenta: el comensal da nombre y teléfono y el
// anfitrión confirma. Ruta pública (no requiere sesión de portal) — la
// organización se resuelve desde `?org=` o desde el par mesa+token del QR
// (`?table=&token=`), igual que el menú digital.

export const dynamic = "force-dynamic";

type OrgCtx = { organizationId: string; locationId: string | null };

/** Resuelve la organización de la solicitud (org directa o QR de mesa). */
async function resolveOrg(url: URL): Promise<OrgCtx | { error: string; status: number }> {
  const orgId = url.searchParams.get("org");
  if (orgId) {
    const org = await prisma.organization.findFirst({
      where: { id: orgId },
      select: { id: true },
    });
    if (!org) return { error: "Organización no encontrada", status: 404 };
    return { organizationId: org.id, locationId: null };
  }

  const tableId = url.searchParams.get("table");
  const tableToken = url.searchParams.get("token");
  if (tableId) {
    if (!tableToken) {
      return { error: "Token de mesa requerido: escanea el QR de tu mesa", status: 400 };
    }
    const table = await prisma.table.findFirst({
      where: { id: tableId, qrToken: tableToken, isActive: true },
      select: { id: true, organizationId: true, locationId: true },
    });
    if (!table) return { error: "QR de mesa inválido", status: 400 };
    return { organizationId: table.organizationId, locationId: table.locationId };
  }

  return { error: "Organización requerida (?org= o ?table=&token=)", status: 400 };
}

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
    const org = await resolveOrg(url);
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
    const org = await resolveOrg(url);
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
    const party = Math.max(1, Math.min(Number(guests) || 2, 50));
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000); // mesa por 2h

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
        phone: guestPhone,
        startsAt: start,
        endsAt: end,
        notes: notes || "Reservación sin cuenta (invitado)",
      },
      include: {
        room: { select: { id: true, name: true } },
        table: { select: { id: true, number: true, name: true } },
      },
    });
    return NextResponse.json({ ok: true, reservation });
  } catch (err) {
    console.error("[public/reservations] POST", err);
    return NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 });
  }
}