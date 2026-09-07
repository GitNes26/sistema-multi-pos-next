import { prisma } from "@/lib/db";
import { persistNotification } from "@/lib/notifications/helpers";

// Lista de espera de mesas: cuando una mesa queda libre, este barrido empareja
// a los clientes en espera (por orden de llegada) con una mesa que les quepa
// (capacidad >= comensales) y les notifica en vivo. Corre al liberarse una
// mesa (broadcastTableUpdate con status "free") y de forma oportunista al
// consultar la lista desde el portal.

export interface WaitlistMatch {
  entryId: string;
  tableId: string;
  tableNumber: number;
  roomName: string | null;
  guests: number;
  userId: string | null;
}

/**
 * Barre la lista de espera de la organización y marca `available` (con la mesa
 * liberada) las entradas waiting que quepan en una mesa libre, en orden de
 * llegada. Devuelve los emparejamientos; no toca mesas (solo invita).
 */
export async function sweepTableWaitlist(organizationId: string): Promise<WaitlistMatch[]> {
  const waiting = await prisma.tableWaitlist.findMany({
    where: { organizationId, status: "waiting" },
    include: { customer: { select: { id: true, userId: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (waiting.length === 0) return [];

  const freeTables = await prisma.table.findMany({
    where: { organizationId, isActive: true, status: "free" },
    select: {
      id: true,
      number: true,
      capacity: true,
      room: { select: { name: true } },
    },
    orderBy: { number: "asc" },
  });
  if (freeTables.length === 0) return [];

  const taken = new Set<string>();
  const matches: WaitlistMatch[] = [];

  for (const entry of waiting) {
    const fit = freeTables.find((t) => !taken.has(t.id) && t.capacity >= entry.guests);
    if (!fit) continue;
    taken.add(fit.id);

    await prisma.tableWaitlist.update({
      where: { id: entry.id },
      data: { status: "available", availableAt: new Date(), availableTableId: fit.id },
    });

    const userId = entry.customer?.userId ?? null;
    matches.push({
      entryId: entry.id,
      tableId: fit.id,
      tableNumber: fit.number,
      roomName: fit.room?.name ?? null,
      guests: entry.guests,
      userId,
    });

    // Aviso en vivo: notificación persistida + broadcast SSE + Web Push.
    if (userId) {
      persistNotification({
        organizationId,
        userId,
        kind: "table-waitlist",
        title: "¡Mesa disponible!",
        body: `Se liberó la mesa #${fit.number}${
          fit.room?.name ? ` (${fit.room.name})` : ""
        } — cabe tu grupo de ${entry.guests}. Confírmala en Reservar mesa.`,
        severity: "success",
        link: "/portal/reservations",
        metadata: { sound: "table-ready" },
      }).catch(() => {
        // Best-effort: la invitación ya quedó marcada en la lista.
      });
    }
  }

  return matches;
}

/** Posición del cliente en la lista: cuántas entradas waiting se anotaron antes. */
export async function waitlistPosition(entryId: string): Promise<number> {
  const entry = await prisma.tableWaitlist.findUnique({
    where: { id: entryId },
    select: { organizationId: true, createdAt: true },
  });
  if (!entry) return 0;
  return prisma.tableWaitlist.count({
    where: {
      organizationId: entry.organizationId,
      status: "waiting",
      createdAt: { lt: entry.createdAt },
    },
  });
}