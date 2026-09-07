import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePortalCustomer, portalErrorResponse } from "../guard";
import { sweepTableWaitlist, waitlistPosition } from "@/lib/tables/waitlist";

// Lista de espera de mesas del portal: el cliente se anota cuando no hay
// disponibilidad y recibe aviso en vivo (notificación + sonido) en cuanto se
// libera una mesa que le quepa. El barrido corre al liberarse una mesa y de
// forma oportunista en cada consulta (GET).

export const dynamic = "force-dynamic";

/** Entrada activa (waiting/available) del cliente, si existe. */
async function activeEntry(organizationId: string, customerId: string) {
  return prisma.tableWaitlist.findFirst({
    where: { organizationId, customerId, status: { in: ["waiting", "available"] } },
    include: {
      availableTable: {
        select: { id: true, number: true, name: true, capacity: true, room: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

// GET /api/portal/waitlist — estado de mi entrada (barre primero por si hay mesa).
export async function GET() {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  try {
    // Oportunista: si una mesa quedó libre sin broadcast (restart, etc.).
    await sweepTableWaitlist(guard.organizationId);

    const entry = await activeEntry(guard.organizationId, guard.customerId);
    const position = entry ? await waitlistPosition(entry.id) : 0;

    return NextResponse.json({
      ok: true,
      entry: entry
        ? {
            id: entry.id,
            guests: entry.guests,
            status: entry.status,
            position,
            availableAt: entry.availableAt?.toISOString() ?? null,
            availableTable: entry.availableTable
              ? {
                  id: entry.availableTable.id,
                  number: entry.availableTable.number,
                  name: entry.availableTable.name,
                  capacity: entry.availableTable.capacity,
                  room: entry.availableTable.room,
                }
              : null,
          }
        : null,
    });
  } catch (err) {
    return portalErrorResponse(err);
  }
}

// POST /api/portal/waitlist — anotarme a la lista (guests). No duplica entradas activas.
export async function POST(req: Request) {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  try {
    const body = await req.json();
    const guests = Math.max(1, Math.min(Number(body?.guests) || 2, 50));

    const existing = await activeEntry(guard.organizationId, guard.customerId);
    if (existing) {
      return NextResponse.json({
        ok: true,
        entry: {
          id: existing.id,
          guests: existing.guests,
          status: existing.status,
          availableTable: existing.availableTable
            ? {
                id: existing.availableTable.id,
                number: existing.availableTable.number,
                room: existing.availableTable.room,
              }
            : null,
        },
        duplicate: true,
      });
    }

    const entry = await prisma.tableWaitlist.create({
      data: {
        organizationId: guard.organizationId,
        locationId: body?.locationId || null,
        customerId: guard.customerId,
        guests,
      },
    });
    const position = await waitlistPosition(entry.id);

    // Barrido inmediato: quizá ya hay una mesa libre que le quepa.
    await sweepTableWaitlist(guard.organizationId);
    const refreshed = await activeEntry(guard.organizationId, guard.customerId);

    return NextResponse.json({
      ok: true,
      entry: {
        id: entry.id,
        guests: entry.guests,
        status: refreshed?.status ?? entry.status,
        position,
        availableAt: refreshed?.availableAt?.toISOString() ?? null,
        availableTable: refreshed?.availableTable
          ? {
              id: refreshed.availableTable.id,
              number: refreshed.availableTable.number,
              room: refreshed.availableTable.room,
            }
          : null,
      },
    });
  } catch (err) {
    return portalErrorResponse(err);
  }
}

// DELETE /api/portal/waitlist — salir de la lista (cancela mi entrada activa).
export async function DELETE() {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  try {
    const entry = await activeEntry(guard.organizationId, guard.customerId);
    if (entry) {
      await prisma.tableWaitlist.update({
        where: { id: entry.id },
        data: { status: "cancelled" },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return portalErrorResponse(err);
  }
}