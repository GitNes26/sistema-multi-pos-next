import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { $Enums } from "@prisma/client";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";
import { broadcastTableUpdate } from "@/lib/tables/live";
import { upcomingReservationsByTable } from "@/lib/tables/upcoming";

const DENIED_CONFIG = { ok: false, error: "Permiso requerido: locations.manage" };
const DENIED_STATUS = { ok: false, error: "Permiso requerido: pos.use" };

/** Sesión de app con organización (base común de todos los handlers). */
async function requireTablesSession() {
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

// GET /api/tables — List tables for the organization
// GET /api/tables?locationId=xxx — Filter by location
// GET /api/tables?status=free — Filter by status
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const organizationId = effectiveOrgId(session);
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Sin organización" }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const locationId = url.searchParams.get("locationId");
    const status = url.searchParams.get("status");
    const includeSession = url.searchParams.get("includeSession") === "true";

    const where = {
      organizationId,
      isActive: true,
      ...(locationId ? { locationId } : {}),
      ...(status ? { status: status as $Enums.TableStatus } : {}),
    } as const;

    const tables = await prisma.table.findMany({
      where,
      include: {
        location: { select: { id: true, name: true } },
        room: { select: { id: true, name: true, sortOrder: true } },
        sessions: includeSession
          ? {
              where: { endedAt: null },
              include: {
                order: {
                  select: {
                    id: true,
                    orderNumber: true,
                    status: true,
                    total: true,
                    items: {
                      select: {
                        id: true,
                        productName: true,
                        quantity: true,
                        itemStatus: true,
                        selectedOptions: true,
                        comment: true,
                      },
                    },
                  },
                },
              },
              take: 1,
            }
          : false,
        _count: { select: { orders: true, sessions: true } },
      },
      orderBy: { number: "asc" },
    });

    // Aviso de llegada: reservación confirmada próxima por mesa (para que el
    // anfitrión/la cocina preparen el lugar).
    const upcoming = await upcomingReservationsByTable(organizationId, locationId ?? null);
    const tablesWithUpcoming = tables.map((t) => {
      const u = upcoming.get(t.id);
      return {
        ...t,
        upcomingReservation: u ? { guests: u.guests, startsAt: u.startsAt.toISOString() } : null,
      };
    });

    return NextResponse.json({ ok: true, tables: tablesWithUpcoming });
  } catch (error) {
    console.error("[tables] Error:", error);
    return NextResponse.json({ ok: false, error: "Error al obtener mesas" }, { status: 500 });
  }
}

// POST /api/tables — Create a table (solo locations.manage)
export async function POST(req: Request) {
  const guard = await requireTablesSession();
  if ("response" in guard) return guard.response;
  const { session, organizationId } = guard;

  // Crear mesas configura el mapa: exige locations.manage (dueño/gerente/admin).
  if (!hasPermission(session, "locations.manage")) {
    return NextResponse.json(DENIED_CONFIG, { status: 403 });
  }

  try {
    const body = await req.json();
    const { number, name, capacity, locationId, roomId, shape, width, height, posX, posY } = body;

    if (!number) {
      return NextResponse.json({ ok: false, error: "Número de mesa requerido" }, { status: 400 });
    }

    // Check for duplicate number
    const existing = await prisma.table.findFirst({
      where: { organizationId, number: Number(number) },
    });
    if (existing) {
      return NextResponse.json({ ok: false, error: `Ya existe la mesa #${number}` }, { status: 400 });
    }

    const qrToken = randomBytes(16).toString("hex");

    const table = await prisma.table.create({
      data: {
        organizationId,
        number: Number(number),
        name: name || null,
        capacity: Number(capacity) || 4,
        locationId: locationId || null,
        roomId: roomId || null,
        shape: shape || "round",
        width: width != null ? Number(width) : null,
        height: height != null ? Number(height) : null,
        qrToken,
        posX: posX != null ? Number(posX) : null,
        posY: posY != null ? Number(posY) : null,
      },
    });

    return NextResponse.json({ ok: true, table });
  } catch (error) {
    console.error("[tables] POST Error:", error);
    return NextResponse.json({ ok: false, error: "Error al crear mesa" }, { status: 500 });
  }
}

// PUT /api/tables — Update a table.
// - Cambios de configuración (número/nombre/capacidad/sucursal/posición):
//   locations.manage (dueño/gerente/admin en el mapa de mesas).
// - Solo cambio de estado (ocupar/liberar/reservar): abierto al operador del
//   POS (pos.use) para que meseros ocupen y liberen mesas en caja.
export async function PUT(req: Request) {
  const guard = await requireTablesSession();
  if ("response" in guard) return guard.response;
  const { session, organizationId } = guard;

  try {
    const body = await req.json();
    const { id, number, name, capacity, status, locationId, roomId, shape, width, height, posX, posY } = body;

    if (!id) {
      return NextResponse.json({ ok: false, error: "ID de mesa requerido" }, { status: 400 });
    }

    const isConfigChange =
      number !== undefined ||
      name !== undefined ||
      capacity !== undefined ||
      locationId !== undefined ||
      roomId !== undefined ||
      shape !== undefined ||
      width !== undefined ||
      height !== undefined ||
      posX !== undefined ||
      posY !== undefined;
    const isStatusChange = typeof status === "string" && status.length > 0;

    if (isConfigChange && !hasPermission(session, "locations.manage")) {
      return NextResponse.json(DENIED_CONFIG, { status: 403 });
    }
    if (isStatusChange && !hasPermission(session, "locations.manage") && !hasPermission(session, "pos.use")) {
      return NextResponse.json(DENIED_STATUS, { status: 403 });
    }

    // La mesa debe pertenecer a la organización de la sesión.
    const owned = await prisma.table.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ ok: false, error: "Mesa no encontrada" }, { status: 404 });
    }

    const table = await prisma.table.update({
      where: { id },
      data: {
        number: number != null ? Number(number) : undefined,
        name: name !== undefined ? name : undefined,
        capacity: capacity != null ? Number(capacity) : undefined,
        status: status || undefined,
        locationId: locationId !== undefined ? locationId : undefined,
        roomId: roomId !== undefined ? roomId : undefined,
        shape: shape !== undefined ? shape : undefined,
        width: width !== undefined ? (width != null ? Number(width) : null) : undefined,
        height: height !== undefined ? (height != null ? Number(height) : null) : undefined,
        posX: posX !== undefined ? (posX != null ? Number(posX) : null) : undefined,
        posY: posY !== undefined ? (posY != null ? Number(posY) : null) : undefined,
      },
      include: {
        location: { select: { name: true } },
        room: { select: { id: true, name: true } },
      },
    });

    // Broadcast the update so POS/TableSelector subscribers see it instantly.
    if (status) {
      broadcastTableUpdate(organizationId, {
        id: table.id,
        number: table.number,
        name: table.name,
        capacity: table.capacity,
        status: table.status,
        room: table.room ?? null,
        location: table.location,
        updatedAt: table.updatedAt.toISOString(),
      });
    }

    return NextResponse.json({ ok: true, table });
  } catch (error) {
    console.error("[tables] PUT Error:", error);
    return NextResponse.json({ ok: false, error: "Error al actualizar mesa" }, { status: 500 });
  }
}

// DELETE /api/tables?id=xxx — Soft-delete a table (solo locations.manage)
export async function DELETE(req: Request) {
  const guard = await requireTablesSession();
  if ("response" in guard) return guard.response;
  const { session, organizationId } = guard;

  // Eliminar mesas configura el mapa: exige locations.manage.
  if (!hasPermission(session, "locations.manage")) {
    return NextResponse.json(DENIED_CONFIG, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "ID requerido" }, { status: 400 });
    }

    const owned = await prisma.table.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ ok: false, error: "Mesa no encontrada" }, { status: 404 });
    }

    await prisma.table.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[tables] DELETE Error:", error);
    return NextResponse.json({ ok: false, error: "Error al eliminar mesa" }, { status: 500 });
  }
}
