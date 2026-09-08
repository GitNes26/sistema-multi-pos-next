import { prisma } from "@/lib/db";
import { persistNotification } from "@/lib/notifications/helpers";
import {
  notifyGuestWaitlistTableReady,
  notifyGuestWaitlistTableTaken,
} from "@/lib/notifications/messaging";

// Lista de espera de mesas: cuando una mesa queda libre, este barrido empareja
// a los clientes en espera (por orden de llegada) con una mesa que les quepa
// (capacidad >= comensales) y les notifica. Los clientes del portal reciben el
// aviso en vivo (notificación + push); los invitados sin cuenta (nombre +
// teléfono, anotados desde /reservar) lo reciben por WhatsApp/SMS. Corre al
// liberarse una mesa (broadcastTableUpdate con status "free") y de forma
// oportunista al consultar la lista desde el portal.

export interface WaitlistMatch {
  entryId: string;
  tableId: string;
  tableNumber: number;
  roomName: string | null;
  guests: number;
  userId: string | null;
  /** Invitado (sin cuenta): datos para el aviso por WhatsApp/SMS. */
  guestName: string | null;
  guestPhone: string | null;
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

  // Nombre de la organización para el mensaje al invitado (una sola consulta).
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });

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
      guestName: entry.customer ? null : entry.name,
      guestPhone: entry.customer ? null : entry.phone,
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
      continue;
    }

    // Invitado (sin cuenta): aviso por WhatsApp/SMS al teléfono que dejó.
    if (entry.phone) {
      notifyGuestWaitlistTableReady({
        guestName: entry.name,
        phone: entry.phone,
        organizationName: org?.name ?? "el restaurante",
        tableNumber: fit.number,
        roomName: fit.room?.name ?? null,
        guests: entry.guests,
      }).catch((err) => {
        console.error("[waitlist] guest table-ready message failed:", err);
      }); // fire-and-forget: la invitación ya quedó marcada en la lista
    }
  }

  return matches;
}

/**
 * Ofertas vencidas: la mesa que se le ofreció a una entrada `available` se
 * ocupó/reservó antes de que la reclamara. Devuelve cuántas entradas
 * reclamó. Por cada una:
 *  - la regresa a `waiting` y la re-empareja con la siguiente mesa libre que
 *    le quepa (orden de llegada);
 *  - invitado → un solo aviso por WhatsApp/SMS ("se ocupó, te apartamos la
 *    #N" o "se ocupó, te seguimos buscando"); cliente del portal →
 *    notificación en vivo equivalente.
 */
export async function reclaimTakenOffers(organizationId: string): Promise<number> {
  const offered = await prisma.tableWaitlist.findMany({
    where: { organizationId, status: "available" },
    include: {
      customer: { select: { id: true, userId: true } },
      availableTable: {
        select: { id: true, number: true, status: true, room: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  const stale = offered.filter((e) => e.availableTable && e.availableTable.status !== "free");
  if (stale.length === 0) return 0;

  const freeTables = await prisma.table.findMany({
    where: { organizationId, isActive: true, status: "free" },
    select: { id: true, number: true, capacity: true, room: { select: { name: true } } },
    orderBy: { number: "asc" },
  });
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });

  const taken = new Set<string>();
  let reclaimed = 0;

  for (const entry of stale) {
    const takenTable = entry.availableTable!;

    // La oferta venció: regresar a waiting y limpiar la mesa ofrecida.
    await prisma.tableWaitlist.update({
      where: { id: entry.id },
      data: { status: "waiting", availableTableId: null, availableAt: null },
    });
    reclaimed++;

    // Re-emparejar con la siguiente mesa libre que le quepa.
    const fit = freeTables.find((t) => !taken.has(t.id) && t.capacity >= entry.guests);
    let newTable: { number: number; roomName: string | null } | null = null;
    if (fit) {
      taken.add(fit.id);
      await prisma.tableWaitlist.update({
        where: { id: entry.id },
        data: { status: "available", availableAt: new Date(), availableTableId: fit.id },
      });
      newTable = { number: fit.number, roomName: fit.room?.name ?? null };
    }

    // Un solo mensaje por entrada: con la nueva mesa o "te seguimos buscando".
    if (!entry.customer && entry.phone) {
      notifyGuestWaitlistTableTaken({
        guestName: entry.name,
        phone: entry.phone,
        organizationName: org?.name ?? "el restaurante",
        takenTableNumber: takenTable.number,
        newTableNumber: newTable?.number ?? null,
        newRoomName: newTable?.roomName ?? null,
        guests: entry.guests,
      }).catch((err) => {
        console.error("[waitlist] guest table-taken message failed:", err);
      }); // fire-and-forget: la entrada ya quedó re-emparejada
      continue;
    }

    // Cliente del portal: aviso en vivo (notificación + SSE + push).
    if (entry.customer?.userId) {
      persistNotification({
        organizationId,
        userId: entry.customer.userId,
        kind: "table-waitlist",
        severity: newTable ? "info" : "warning",
        title: newTable ? "Cambio de mesa" : "La mesa se ocupó",
        body: newTable
          ? `La mesa #${takenTable.number} se ocupó — te apartamos la #${newTable.number}${
              newTable.roomName ? ` (${newTable.roomName})` : ""
            }. Confírmala en Reservar mesa.`
          : `La mesa #${takenTable.number} se ocupó — sigues en la lista y te avisamos apenas se libere otra.`,
        link: "/portal/reservations",
        metadata: { sound: "notification" },
      }).catch(() => {
        // Best-effort: la entrada ya quedó re-emparejada.
      });
    }
  }

  return reclaimed;
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