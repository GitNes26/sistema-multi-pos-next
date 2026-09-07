import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { broadcastTableUpdate } from "@/lib/tables/live";

const DENIED_STATUS = { ok: false, error: "Permiso requerido: pos.use" };

/**
 * Sesión de app con organización (mismo guard que /api/tables).
 * Operar sesiones de mesa es tarea del operador del POS (pos.use: mesero/
 * cajero); sin él (cocina, repartidor, portal) no puede abrir/cerrar sesiones.
 */
async function requireTablesSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { response: NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 }) };
  }
  const organizationId = effectiveOrgId(session);
  if (!organizationId) {
    return { response: NextResponse.json({ ok: false, error: "Sin organización" }, { status: 403 }) };
  }
  if (!hasPermission(session, "pos.use")) {
    return { response: NextResponse.json(DENIED_STATUS, { status: 403 }) };
  }
  return { session, organizationId };
}

// POST /api/tables/session — Start a session on a table
// Body: { tableId: string, orderId?: string }
export async function POST(req: Request) {
  const guard = await requireTablesSession();
  if ("response" in guard) return guard.response;
  const { organizationId } = guard;

  try {
    const body = await req.json();
    const { tableId, orderId, notes } = body;

    if (!tableId) {
      return NextResponse.json({ ok: false, error: "tableId requerido" }, { status: 400 });
    }

    // Verify table belongs to org (no cross-org session starts)
    const table = await prisma.table.findFirst({
      where: { id: tableId, organizationId },
    });
    if (!table) {
      return NextResponse.json({ ok: false, error: "Mesa no encontrada" }, { status: 404 });
    }

    // End any existing active session on this table
    await prisma.tableSession.updateMany({
      where: { tableId: table.id, endedAt: null },
      data: { endedAt: new Date() },
    });

    // Create new session
    const tableSession = await prisma.tableSession.create({
      data: {
        tableId: table.id,
        orderId: orderId || null,
        notes: notes || null,
      },
    });

    // Update table status to occupied
    const updatedTable = await prisma.table.update({
      where: { id: table.id },
      data: { status: "occupied" },
      include: { location: { select: { name: true } } },
    });

    broadcastTableUpdate(organizationId, {
      id: updatedTable.id,
      number: updatedTable.number,
      name: updatedTable.name,
      capacity: updatedTable.capacity,
      status: updatedTable.status,
      location: updatedTable.location,
      updatedAt: updatedTable.updatedAt.toISOString(),
    });

    return NextResponse.json({ ok: true, session: tableSession });
  } catch (error) {
    console.error("[tables/session] POST Error:", error);
    return NextResponse.json({ ok: false, error: "Error al iniciar sesión" }, { status: 500 });
  }
}

/**
 * Cierra las sesiones activas de una mesa (verificada por organización) y
 * libera la mesa si quedan sesiones abiertas. Devuelve 404 si la mesa no
 * pertenece a la organización de la sesión.
 */
async function endSessionsForTable(organizationId: string, tableId: string) {
  const table = await prisma.table.findFirst({
    where: { id: tableId, organizationId },
    select: { id: true },
  });
  if (!table) return null;

  await prisma.tableSession.updateMany({
    where: { tableId: table.id, endedAt: null },
    data: { endedAt: new Date() },
  });

  return prisma.table.update({
    where: { id: table.id },
    data: { status: "free" },
    include: { location: { select: { name: true } } },
  });
}

// PUT /api/tables/session — End a session / Link order
// Body: { sessionId: string, orderId?: string } or { tableId: string }
export async function PUT(req: Request) {
  const guard = await requireTablesSession();
  if ("response" in guard) return guard.response;
  const { organizationId } = guard;

  try {
    const body = await req.json();
    const { sessionId, tableId, orderId } = body;

    if (sessionId) {
      // La sesión debe pertenecer a una mesa de la organización de la
      // sesión: evita cerrar sesiones cruzando organizaciones.
      const session = await prisma.tableSession.findFirst({
        where: { id: sessionId, table: { organizationId } },
        select: { id: true, tableId: true, endedAt: true },
      });
      if (!session) {
        return NextResponse.json({ ok: false, error: "Sesión no encontrada" }, { status: 404 });
      }

      const updated = await prisma.tableSession.update({
        where: { id: session.id },
        data: {
          endedAt: new Date(),
          orderId: orderId || undefined,
        },
      });

      // Check if table has other active sessions
      const activeSessions = await prisma.tableSession.count({
        where: { tableId: updated.tableId, endedAt: null },
      });

      if (activeSessions === 0) {
        const freedTable = await prisma.table.update({
          where: { id: updated.tableId },
          data: { status: "free" },
          include: { location: { select: { name: true } } },
        });
        broadcastTableUpdate(organizationId, {
          id: freedTable.id,
          number: freedTable.number,
          name: freedTable.name,
          capacity: freedTable.capacity,
          status: freedTable.status,
          location: freedTable.location,
          updatedAt: freedTable.updatedAt.toISOString(),
        });
      }

      return NextResponse.json({ ok: true, session: updated });
    }

    if (tableId) {
      // End all active sessions on table (org-scoped)
      const freedTable = await endSessionsForTable(organizationId, tableId);
      if (!freedTable) {
        return NextResponse.json({ ok: false, error: "Mesa no encontrada" }, { status: 404 });
      }

      broadcastTableUpdate(organizationId, {
        id: freedTable.id,
        number: freedTable.number,
        name: freedTable.name,
        capacity: freedTable.capacity,
        status: freedTable.status,
        location: freedTable.location,
        updatedAt: freedTable.updatedAt.toISOString(),
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "sessionId o tableId requerido" }, { status: 400 });
  } catch (error) {
    console.error("[tables/session] PUT Error:", error);
    return NextResponse.json({ ok: false, error: "Error al actualizar sesión" }, { status: 500 });
  }
}

// PATCH /api/tables/session — Alias de PUT (cierre por tableId) para clientes
// que usan PATCH al liberar la mesa desde el POS (ticket-panel).
export async function PATCH(req: Request) {
  return PUT(req);
}
