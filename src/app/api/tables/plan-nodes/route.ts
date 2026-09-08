import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { $Enums } from "@prisma/client";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const DENIED = { ok: false, error: "Permiso requerido: locations.manage" };
const KINDS: $Enums.PlanNodeKind[] = ["entrance", "exit", "restroom", "kitchen", "bar_station", "cashier", "other"];

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

// GET /api/tables/plan-nodes — Nodos fijos del plano (opcional ?locationId=).
export async function GET(req: Request) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  try {
    const url = new URL(req.url);
    const locationId = url.searchParams.get("locationId");
    const nodes = await prisma.planNode.findMany({
      where: { organizationId: guard.organizationId, ...(locationId ? { locationId } : {}) },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ ok: true, nodes });
  } catch (error) {
    console.error("[tables/plan-nodes] GET Error:", error);
    return NextResponse.json({ ok: false, error: "Error al obtener nodos del plano" }, { status: 500 });
  }
}

// POST /api/tables/plan-nodes — Crear nodo (solo locations.manage).
export async function POST(req: Request) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  if (!hasPermission(guard.session, "locations.manage")) {
    return NextResponse.json(DENIED, { status: 403 });
  }

  try {
    const body = await req.json();
    const kind = KINDS.includes(body?.kind) ? (body.kind as $Enums.PlanNodeKind) : "other";
    const posX = Math.round(Number(body?.posX));
    const posY = Math.round(Number(body?.posY));
    if (!Number.isFinite(posX) || !Number.isFinite(posY)) {
      return NextResponse.json({ ok: false, error: "Posición requerida" }, { status: 400 });
    }
    const node = await prisma.planNode.create({
      data: {
        organizationId: guard.organizationId,
        locationId: body?.locationId || null,
        roomId: body?.roomId || null,
        kind,
        label: typeof body?.label === "string" && body.label.trim() ? body.label.trim().slice(0, 60) : null,
        posX,
        posY,
      },
    });
    return NextResponse.json({ ok: true, node });
  } catch (error) {
    console.error("[tables/plan-nodes] POST Error:", error);
    return NextResponse.json({ ok: false, error: "Error al crear nodo" }, { status: 500 });
  }
}

// PUT /api/tables/plan-nodes — Mover/renombrar nodo (solo locations.manage).
export async function PUT(req: Request) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  if (!hasPermission(guard.session, "locations.manage")) {
    return NextResponse.json(DENIED, { status: 403 });
  }

  try {
    const body = await req.json();
    if (!body?.id) {
      return NextResponse.json({ ok: false, error: "ID requerido" }, { status: 400 });
    }
    const owned = await prisma.planNode.findFirst({
      where: { id: body.id, organizationId: guard.organizationId },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ ok: false, error: "Nodo no encontrado" }, { status: 404 });
    }
    const node = await prisma.planNode.update({
      where: { id: body.id },
      data: {
        label:
          body.label !== undefined
            ? typeof body.label === "string" && body.label.trim()
              ? body.label.trim().slice(0, 60)
              : null
            : undefined,
        posX: body.posX != null ? Math.round(Number(body.posX)) : undefined,
        posY: body.posY != null ? Math.round(Number(body.posY)) : undefined,
        roomId: body.roomId !== undefined ? body.roomId || null : undefined,
      },
    });
    return NextResponse.json({ ok: true, node });
  } catch (error) {
    console.error("[tables/plan-nodes] PUT Error:", error);
    return NextResponse.json({ ok: false, error: "Error al actualizar nodo" }, { status: 500 });
  }
}

// DELETE /api/tables/plan-nodes?id= — Eliminar nodo (solo locations.manage).
export async function DELETE(req: Request) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;

  if (!hasPermission(guard.session, "locations.manage")) {
    return NextResponse.json(DENIED, { status: 403 });
  }

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "ID requerido" }, { status: 400 });
    }
    const owned = await prisma.planNode.findFirst({
      where: { id, organizationId: guard.organizationId },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ ok: false, error: "Nodo no encontrado" }, { status: 404 });
    }
    await prisma.planNode.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[tables/plan-nodes] DELETE Error:", error);
    return NextResponse.json({ ok: false, error: "Error al eliminar nodo" }, { status: 500 });
  }
}
