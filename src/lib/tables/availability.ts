import { prisma } from "@/lib/db";
import { parseSchedule, type DaySchedule } from "@/lib/schedule";
import type { ReservationPolicy } from "@prisma/client";
import {
  getReservationPolicy,
  locationSchedule,
  slotsForDay,
  dayInPolicyWindow,
} from "@/lib/tables/reservations-policy";
import { dayBounds } from "@/lib/tables/reservations-utils";

// Cálculo de disponibilidad de reservaciones de mesa compartido por las rutas
// de app (panel/portal vía /api/table-reservations/availability) y pública
// (invitado vía /api/public/reservations/availability). Tres modos:
// - sin `date`: días seleccionables del calendario (horario de la sucursal
//   dentro de la ventana de la política) + política vigente.
// - con `date`: slots del día con cupo por sala (respetando comensales).
// - con `date` + `time`: mesas del slot (libre/ocupada) para elegir dónde
//   sentarse en el plano.

export function policyView(p: ReservationPolicy) {
  return {
    enabled: p.enabled,
    minNoticeMinutes: p.minNoticeMinutes,
    maxAdvanceDays: p.maxAdvanceDays,
    maxGuests: p.maxGuests,
    durationMinutes: p.durationMinutes,
    slotMinutes: p.slotMinutes,
    requireConfirmation: p.requireConfirmation,
    notesText: p.notesText,
  };
}

export async function computeAvailability(
  organizationId: string,
  locationId: string | null,
  date: string | null,
  time: string | null,
  guests: number
): Promise<
  | { ok: false; error: string; status: number }
  | {
      ok: true;
      days?: string[];
      date?: string;
      guests?: number;
      policy: ReturnType<typeof policyView>;
      slots?: { time: string; rooms: { id: string; name: string; total: number; free: number }[] }[];
      tables?: {
        id: string;
        number: number;
        name: string | null;
        capacity: number;
        shape: string;
        width: number | null;
        height: number | null;
        posX: number | null;
        posY: number | null;
        roomId: string | null;
        roomName: string | null;
        free: boolean;
      }[];
    }
> {
  const policy = await getReservationPolicy(organizationId);
  const schedule: DaySchedule[] | null = await locationSchedule(locationId);
  const parsed = schedule ?? parseSchedule(null);

  // Modo 1: días del calendario.
  if (!date) {
    const days: string[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < policy.maxAdvanceDays; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!dayInPolicyWindow(policy, ymd)) continue;
      const daySchedule = parsed.find((s) => s.day === d.getDay());
      if (schedule && daySchedule && !daySchedule.enabled) continue;
      days.push(ymd);
    }
    return { ok: true, days, policy: policyView(policy) };
  }

  if (!dayInPolicyWindow(policy, date)) {
    return { ok: false, error: "Fecha fuera de la ventana de reservación", status: 400 };
  }

  // Modo 3: mesas concretas del slot elegido (date + time "HH:MM").
  if (time) {
    const validSlots = slotsForDay(policy, schedule, date);
    if (!validSlots.includes(time)) {
      return { ok: false, error: "La sucursal no recibe reservaciones a esa hora", status: 400 };
    }
    const { from } = dayBounds(date);
    const [h, m] = time.split(":").map(Number);
    const slotStart = new Date(from);
    slotStart.setHours(h, m, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + policy.durationMinutes * 60 * 1000);

    const [tables, reservations] = await Promise.all([
      prisma.table.findMany({
        where: { organizationId, isActive: true, ...(locationId ? { locationId } : {}) },
        select: {
          id: true,
          number: true,
          name: true,
          capacity: true,
          shape: true,
          width: true,
          height: true,
          posX: true,
          posY: true,
          status: true,
          roomId: true,
          room: { select: { name: true } },
        },
        orderBy: { number: "asc" },
      }),
      prisma.tableReservation.findMany({
        where: {
          organizationId,
          startsAt: { lt: slotEnd },
          endsAt: { gt: slotStart },
          status: { in: ["pending", "confirmed", "seated"] },
          ...(locationId ? { locationId } : {}),
        },
        select: { tableId: true },
      }),
    ]);
    const taken = new Set(reservations.map((r) => r.tableId).filter(Boolean) as string[]);

    return {
      ok: true,
      date,
      guests,
      policy: policyView(policy),
      tables: tables.map((t) => ({
        id: t.id,
        number: t.number,
        name: t.name,
        capacity: t.capacity,
        shape: t.shape,
        width: t.width,
        height: t.height,
        posX: t.posX,
        posY: t.posY,
        roomId: t.roomId,
        roomName: t.room?.name ?? null,
        // Encajar a los comensales y no estar ocupada/reservada en el slot.
        free: t.capacity >= guests && t.status !== "occupied" && !taken.has(t.id),
      })),
    };
  }

  // Modo 2: slots del día con cupo por sala.
  const slots = slotsForDay(policy, schedule, date);
  const { from, to } = dayBounds(date);
  const [tables, reservations] = await Promise.all([
    prisma.table.findMany({
      where: { organizationId, isActive: true, ...(locationId ? { locationId } : {}) },
      select: {
        id: true,
        capacity: true,
        status: true,
        roomId: true,
        room: { select: { id: true, name: true } },
      },
      orderBy: { number: "asc" },
    }),
    prisma.tableReservation.findMany({
      where: {
        organizationId,
        startsAt: { lt: to },
        endsAt: { gt: from },
        status: { in: ["pending", "confirmed", "seated"] },
        ...(locationId ? { locationId } : {}),
      },
      select: { tableId: true, startsAt: true, endsAt: true },
    }),
  ]);

  const slotDetails = slots.map((hm) => {
    const [h, m] = hm.split(":").map(Number);
    const slotStart = new Date(from);
    slotStart.setHours(h, m, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + policy.durationMinutes * 60 * 1000);

    const rooms = new Map<string, { id: string; name: string; total: number; free: number }>();
    for (const t of tables) {
      if (t.capacity < guests) continue;
      const key = t.room?.id ?? "_sin_sala";
      const entry = rooms.get(key) ?? {
        id: key,
        name: t.room?.name ?? "Sin sala",
        total: 0,
        free: 0,
      };
      entry.total += 1;
      const overlaps = reservations.some((r) => {
        if (r.tableId !== t.id) return false;
        return new Date(r.startsAt) < slotEnd && new Date(r.endsAt) > slotStart;
      });
      if (t.status !== "occupied" && !overlaps) entry.free += 1;
      rooms.set(key, entry);
    }
    return { time: hm, rooms: [...rooms.values()] };
  });

  return { ok: true, date, guests, policy: policyView(policy), slots: slotDetails };
}
