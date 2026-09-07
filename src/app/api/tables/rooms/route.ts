import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

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

// GET /api/tables/rooms — Salas del local (opcional ?locationId=)
export async function GET(req: Request) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;
  const { organizationId } = guard;

  try {
    const url = new URL(req.url);
    const locationId = url.searchParams.get("locationId");
    const rooms = await prisma.tableRoom.findMany({
      where: { organizationId, isActive: true, ...(locationId ? { locationId } : {}) },
      include: {
        location: { select: { id: true, name: true } },
        _count: { select: { tables: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return NextResponse.json({ ok: true, rooms });
  } catch (error) {
    console.error("[tables/rooms] GET Error:", error);
    return NextResponse.json({ ok: false, error: "Error al obtener salas" }, { status: 500 });
  }
}

// POST /api/tables/rooms — Crear sala (solo locations.manage)
export async function POST(req: Request) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;
  const { session, organizationId } = guard;

  if (!hasPermission(session, "locations.manage")) {
    return NextResponse.json(DENIED, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, locationId, sortOrder } = body;
    const cleanName = String(name ?? "").trim();
    if (!cleanName) {
      return NextResponse.json({ ok: false, error: "Nombre de sala requerido" }, { status: 400 });
    }
    const existing = await prisma.tableRoom.findFirst({
      where: { organizationId, name: cleanName },
    });
    if (existing) {
      return NextResponse.json({ ok: false, error: `Ya existe la sala «${cleanName}»` }, { status: 400 });
    }
    const max = await prisma.tableRoom.aggregate({
      where: { organizationId },
      _max: { sortOrder: true },
    });
    const room = await prisma.tableRoom.create({
      data: {
        organizationId,
        locationId: locationId || null,
        name: cleanName,
        sortOrder: sortOrder != null ? Number(sortOrder) : (max._max.sortOrder ?? -1) + 1,
      },
    });
    return NextResponse.json({ ok: true, room });
  } catch (error) {
    console.error("[tables/rooms] POST Error:", error);
    return NextResponse.json({ ok: false, error: "Error al crear sala" }, { status: 500 });
  }
}

// PUT /api/tables/rooms — Renombrar/reordenar/mover sala (solo locations.manage)
export async function PUT(req: Request) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;
  const { session, organizationId } = guard;

  if (!hasPermission(session, "locations.manage")) {
    return NextResponse.json(DENIED, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, name, locationId, sortOrder, isActive } = body;
    if (!id) {
      return NextResponse.json({ ok: false, error: "ID de sala requerido" }, { status: 400 });
    }
    const owned = await prisma.tableRoom.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ ok: false, error: "Sala no encontrada" }, { status: 404 });
    }
    if (name !== undefined) {
      const clean = String(name).trim();
      if (!clean) {
        return NextResponse.json({ ok: false, error: "Nombre de sala requerido" }, { status: 400 });
      }
      const dup = await prisma.tableRoom.findFirst({
        where: { organizationId, name: clean, NOT: { id } },
      });
      if (dup) {
        return NextResponse.json({ ok: false, error: `Ya existe la sala «${clean}»` }, { status: 400 });
      }
    }
    const room = await prisma.tableRoom.update({
      where: { id },
      data: {
        name: name !== undefined ? String(name).trim() : undefined,
        locationId: locationId !== undefined ? locationId : undefined,
        sortOrder: sortOrder != null ? Number(sortOrder) : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      },
    });
    return NextResponse.json({ ok: true, room });
  } catch (error) {
    console.error("[tables/rooms] PUT Error:", error);
    return NextResponse.json({ ok: false, error: "Error al actualizar sala" }, { status: 500 });
  }
}

// DELETE /api/tables/rooms?id=xxx — Eliminar sala (solo locations.manage).
// Las mesas de la sala quedan sin sala (roomId = null), no se borran.
export async function DELETE(req: Request) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;
  const { session, organizationId } = guard;

  if (!hasPermission(session, "locations.manage")) {
    return NextResponse.json(DENIED, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "ID requerido" }, { status: 400 });
    }
    const owned = await prisma.tableRoom.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ ok: false, error: "Sala no encontrada" }, { status: 404 });
    }
    await prisma.$transaction([
      prisma.table.updateMany({ where: { roomId: id }, data: { roomId: null } }),
      prisma.tableRoom.update({ where: { id }, data: { isActive: false } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[tables/rooms] DELETE Error:", error);
    return NextResponse.json({ ok: false, error: "Error al eliminar sala" }, { status: 500 });
  }
}