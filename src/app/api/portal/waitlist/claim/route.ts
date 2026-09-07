import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePortalCustomer, portalErrorResponse } from "../../guard";

// POST /api/portal/waitlist/claim — el cliente confirma la mesa liberada:
// crea la reservación (pending) con esa mesa y cierra la entrada (seated).
export const dynamic = "force-dynamic";

export async function POST() {
  const guard = await requirePortalCustomer();
  if ("response" in guard) return guard.response;

  try {
    const entry = await prisma.tableWaitlist.findFirst({
      where: { organizationId: guard.organizationId, customerId: guard.customerId, status: "available" },
      include: { availableTable: { select: { id: true, number: true, capacity: true, status: true } } },
      orderBy: { createdAt: "desc" },
    });
    if (!entry || !entry.availableTable) {
      return NextResponse.json(
        { ok: false, error: "No tienes una mesa disponible para confirmar" },
        { status: 409 }
      );
    }
    if (entry.availableTable.status === "occupied") {
      // La mesa se tomó mientras tanto: cerrar la invitación y avisar.
      await prisma.tableWaitlist.update({
        where: { id: entry.id },
        data: { status: "cancelled" },
      });
      return NextResponse.json(
        { ok: false, error: "La mesa fue tomada mientras tanto — vuelve a anotarte" },
        { status: 409 }
      );
    }

    const now = new Date();
    const reservation = await prisma.tableReservation.create({
      data: {
        organizationId: guard.organizationId,
        locationId: entry.locationId,
        roomId: null,
        tableId: entry.availableTableId,
        customerId: guard.customerId,
        guests: entry.guests,
        startsAt: now,
        endsAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        notes: "Confirmada desde lista de espera",
      },
      include: {
        table: { select: { id: true, number: true } },
        room: { select: { id: true, name: true } },
      },
    });

    await prisma.tableWaitlist.update({
      where: { id: entry.id },
      data: { status: "seated", seatedTableId: entry.availableTableId },
    });

    return NextResponse.json({ ok: true, reservation });
  } catch (err) {
    return portalErrorResponse(err);
  }
}