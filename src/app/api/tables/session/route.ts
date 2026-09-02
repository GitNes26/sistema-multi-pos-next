import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { prisma } from "@/lib/db";
import { broadcastTableUpdate } from "@/lib/tables/live";

// POST /api/tables/session — Start a session on a table
// Body: { tableId: string, orderId?: string }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const organizationId = effectiveOrgId(session);
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Sin organización" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { tableId, orderId, notes } = body;

    if (!tableId) {
      return NextResponse.json({ ok: false, error: "tableId requerido" }, { status: 400 });
    }

    // Verify table belongs to org
    const table = await prisma.table.findFirst({
      where: { id: tableId, organizationId },
    });
    if (!table) {
      return NextResponse.json({ ok: false, error: "Mesa no encontrada" }, { status: 404 });
    }

    // End any existing active session on this table
    await prisma.tableSession.updateMany({
      where: { tableId, endedAt: null },
      data: { endedAt: new Date() },
    });

    // Create new session
    const tableSession = await prisma.tableSession.create({
      data: {
        tableId,
        orderId: orderId || null,
        notes: notes || null,
      },
    });

    // Update table status to occupied
    const updatedTable = await prisma.table.update({
      where: { id: tableId },
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

// PUT /api/tables/session — End a session / Link order
// Body: { sessionId: string, orderId?: string } or { tableId: string }
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  const organizationId = effectiveOrgId(session);
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "Sin organización" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { sessionId, tableId, orderId } = body;

    if (sessionId) {
      // End specific session
      const updated = await prisma.tableSession.update({
        where: { id: sessionId },
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
      // End all active sessions on table
      await prisma.tableSession.updateMany({
        where: { tableId, endedAt: null },
        data: { endedAt: new Date() },
      });

      const freedTable = await prisma.table.update({
        where: { id: tableId },
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

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "sessionId o tableId requerido" }, { status: 400 });
  } catch (error) {
    console.error("[tables/session] PUT Error:", error);
    return NextResponse.json({ ok: false, error: "Error al actualizar sesión" }, { status: 500 });
  }
}
