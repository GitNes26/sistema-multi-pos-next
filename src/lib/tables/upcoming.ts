import { prisma } from "@/lib/db";

// Reservaciones confirmadas PRÓXIMAS (aviso de llegada): el anfitrión/la
// cocina preparan el lugar. Ventana: reservas confirmadas que inician en las
// próximas N horas — configurable por organización (`upcomingWindowHours`,
// default 3 h, rango 1–24) desde *Panel → Mesas*.

export const UPCOMING_WINDOW_MS = 3 * 60 * 60 * 1000; // default (3 horas)
export const DEFAULT_UPCOMING_WINDOW_HOURS = 3;
export const MAX_UPCOMING_WINDOW_HOURS = 24;

// Cache corto de la ventana por organización: la config cambia rara vez pero
// el aviso se recalcula en cada ciclo del stream del POS.
const globalForUpcomingWindow = globalThis as unknown as {
  upcomingWindowCache: Map<string, { value: number; at: number }> | undefined;
};
const windowCache =
  globalForUpcomingWindow.upcomingWindowCache ?? new Map<string, { value: number; at: number }>();
if (process.env.NODE_ENV !== "production") globalForUpcomingWindow.upcomingWindowCache = windowCache;
const WINDOW_CACHE_TTL_MS = 60_000;

/** Ventana (en ms) configurada por la organización, con clamps de seguridad. */
export async function getUpcomingWindowMs(organizationId: string): Promise<number> {
  const cached = windowCache.get(organizationId);
  if (cached && Date.now() - cached.at < WINDOW_CACHE_TTL_MS) return cached.value;

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { upcomingWindowHours: true },
  });
  const hours = Math.max(
    1,
    Math.min(Number(org?.upcomingWindowHours) || DEFAULT_UPCOMING_WINDOW_HOURS, MAX_UPCOMING_WINDOW_HOURS)
  );
  const value = hours * 60 * 60 * 1000;
  windowCache.set(organizationId, { value, at: Date.now() });
  return value;
}

/** Invalida el cache de la ventana (al actualizar la configuración). */
export function invalidateUpcomingWindowCache(organizationId: string) {
  windowCache.delete(organizationId);
}

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
  const horizon = new Date(now.getTime() + (await getUpcomingWindowMs(organizationId)));
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
  const horizon = new Date(now.getTime() + (await getUpcomingWindowMs(organizationId)));

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
