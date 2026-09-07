import { prisma } from "@/lib/db";

// Reservaciones confirmadas PRÓXIMAS (aviso de llegada): el anfitrión/la
// cocina preparan el lugar. Ventana: reservas confirmadas que inician en las
// próximas UPCOMING_WINDOW_MS (por defecto 3h). Devuelve por mesa la más
// próxima (primera por startsAt).

export const UPCOMING_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 horas

export interface UpcomingReservation {
  guests: number;
  startsAt: Date;
}

/**
 * Filas completas (con mesa/sala) de reservaciones confirmadas próximas, para
 * la tira "Próximas reservas" del KDS. Ordenadas por hora de llegada.
 */
export async function listUpcomingReservations(
  organizationId: string,
  locationId?: string | null
) {
  const now = new Date();
  const horizon = new Date(now.getTime() + UPCOMING_WINDOW_MS);
  return prisma.tableReservation.findMany({
    where: {
      organizationId,
      status: "confirmed",
      tableId: { not: null },
      startsAt: { gte: now, lte: horizon },
      ...(locationId ? { locationId } : {}),
    },
    select: {
      id: true,
      guests: true,
      startsAt: true,
      table: {
        select: {
          id: true,
          number: true,
          name: true,
          room: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { startsAt: "asc" },
  });
}

/**
 * Mapa tableId → { guests, startsAt } con la reservación confirmada más
 * próxima de cada mesa dentro de la ventana. `null` si la mesa no tiene.
 */
export async function upcomingReservationsByTable(
  organizationId: string,
  locationId?: string | null
): Promise<Map<string, UpcomingReservation>> {
  const now = new Date();
  const horizon = new Date(now.getTime() + UPCOMING_WINDOW_MS);

  const rows = await prisma.tableReservation.findMany({
    where: {
      organizationId,
      status: "confirmed",
      tableId: { not: null },
      startsAt: { gte: now, lte: horizon },
      ...(locationId ? { locationId } : {}),
    },
    select: { tableId: true, guests: true, startsAt: true },
    orderBy: { startsAt: "asc" },
  });

  const map = new Map<string, UpcomingReservation>();
  for (const r of rows) {
    if (r.tableId && !map.has(r.tableId)) {
      map.set(r.tableId, { guests: r.guests, startsAt: r.startsAt });
    }
  }
  return map;
}