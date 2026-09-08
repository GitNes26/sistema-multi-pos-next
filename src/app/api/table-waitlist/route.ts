import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { effectiveOrgId } from "@/lib/auth/org-context";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { waitlistPosition } from "@/lib/tables/waitlist";
import { notifyGuestWaitlistSeated } from "@/lib/notifications/messaging";

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

// GET /api/table-waitlist — lista de espera activa (anfitrión).
export async function GET() {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;
  const { session, organizationId } = guard;

  if (!hasPermission(session, "locations.manage")) {
    return NextResponse.json(DENIED, { status: 403 });
  }

  try {
    const entries = await prisma.tableWaitlist.findMany({
      where: { organizationId, status: { in: ["waiting", "available"] } },
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
        availableTable: {
          select: { id: true, number: true, capacity: true, room: { select: { name: true } } },
        },
      },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    });

    const withPositions = await Promise.all(
      entries.map(async (e) => ({
        id: e.id,
        guests: e.guests,
        status: e.status,
        position: (await waitlistPosition(e.id)) + 1,
        availableAt: e.availableAt?.toISOString() ?? null,
        // Invitado (sin cuenta): nombre y teléfono van en la fila.
        name: e.name,
        phone: e.phone,
        customer: e.customer
          ? { id: e.customer.id, fullName: e.customer.fullName, phone: e.customer.phone }
          : null,
        availableTable: e.availableTable
          ? {
              id: e.availableTable.id,
              number: e.availableTable.number,
              capacity: e.availableTable.capacity,
              room: e.availableTable.room,
            }
          : null,
      }))
    );

    return NextResponse.json({ ok: true, entries: withPositions });
  } catch (error) {
    console.error("[table-waitlist] GET Error:", error);
    return NextResponse.json({ ok: false, error: "Error al obtener la lista de espera" }, { status: 500 });
  }
}

// PATCH /api/table-waitlist — el anfitrión cierra una entrada (sentado/cancelado).
export async function PATCH(req: Request) {
  const guard = await requireSession();
  if ("response" in guard) return guard.response;
  const { session, organizationId } = guard;

  if (!hasPermission(session, "locations.manage")) {
    return NextResponse.json(DENIED, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, status } = body;
    if (!id || !status) {
      return NextResponse.json({ ok: false, error: "id y status requeridos" }, { status: 400 });
    }
    const owned = await prisma.tableWaitlist.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        status: true,
        guests: true,
        name: true,
        phone: true,
        customerId: true,
        availableTableId: true,
      },
    });
    if (!owned) {
      return NextResponse.json({ ok: false, error: "Entrada no encontrada" }, { status: 404 });
    }

    const seating = status === "seated" && owned.status !== "seated";
    const entry = await prisma.tableWaitlist.update({
      where: { id },
      data: {
        status: status === "seated" ? "seated" : "cancelled",
        // Sentar al invitado en la mesa ofrecida: registrarla como sentada.
        ...(seating && owned.availableTableId ? { seatedTableId: owned.availableTableId } : {}),
      },
    });

    // Confirmación al invitado (sin cuenta) con el número de su mesa.
    // Fire-and-forget: un fallo de mensajería no bloquea al anfitrión.
    if (seating && !owned.customerId && owned.phone) {
      const [table, org] = await Promise.all([
        owned.availableTableId
          ? prisma.table.findUnique({
              where: { id: owned.availableTableId },
              select: { number: true, room: { select: { name: true } } },
            })
          : Promise.resolve(null),
        prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
      ]);
      notifyGuestWaitlistSeated({
        guestName: owned.name,
        phone: owned.phone,
        organizationName: org?.name ?? "el restaurante",
        tableNumber: table?.number ?? null,
        roomName: table?.room?.name ?? null,
        guests: owned.guests,
      }).catch((err) => {
        console.error("[table-waitlist] guest seated message failed:", err);
      });
    }

    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    console.error("[table-waitlist] PATCH Error:", error);
    return NextResponse.json({ ok: false, error: "Error al actualizar la entrada" }, { status: 500 });
  }
}