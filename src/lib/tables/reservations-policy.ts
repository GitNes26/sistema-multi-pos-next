import { prisma } from "@/lib/db";
import { parseSchedule, type DaySchedule } from "@/lib/schedule";
import type { ReservationPolicy } from "@prisma/client";
import { dayBounds, hmToMinutes } from "@/lib/tables/reservations-utils";

// Políticas de reservación de mesas: se configuran una vez por organización
// (Mesas → Política de reservación) y se aplican en todos los flujos: portal
// con cuenta, invitado (/reservar) y panel administrativo. También concentran
// la disponibilidad: qué días puede seleccionar el cliente (horario de la
// sucursal) y qué horarios tiene la sucursal abiertos (slots).

/** Política de la organización con defaults aplicados (siempre usable). */
export async function getReservationPolicy(organizationId: string): Promise<ReservationPolicy> {
  const existing = await prisma.reservationPolicy.findUnique({
    where: { organizationId },
  });
  if (existing) return existing;
  return prisma.reservationPolicy.create({ data: { organizationId } });
}

export type PolicyViolation = { field: string; message: string };

const MAX_SLOT_MINUTES = 180;

/** Normaliza/valida el payload del formulario de políticas. */
export async function upsertReservationPolicy(
  organizationId: string,
  input: Record<string, unknown>
): Promise<ReservationPolicy> {
  const num = (v: unknown, def: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n > 0 ? n : def;
  };
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

  const enabled = input.enabled === undefined ? true : Boolean(input.enabled);
  const minNoticeMinutes = clamp(num(input.minNoticeMinutes, 60), 0, 60 * 24 * 30);
  const maxAdvanceDays = clamp(num(input.maxAdvanceDays, 60), 1, 365);
  const maxGuests = clamp(num(input.maxGuests, 20), 1, 200);
  const durationMinutes = clamp(num(input.durationMinutes, 120), 30, 600);
  const slotMinutes = clamp(num(input.slotMinutes, 30), 15, MAX_SLOT_MINUTES);
  const perDayRaw = input.maxReservationsPerDay;
  const maxReservationsPerDay =
    perDayRaw === null || perDayRaw === undefined || perDayRaw === ""
      ? null
      : clamp(num(perDayRaw, 1), 1, 999);
  const requireConfirmation = Boolean(input.requireConfirmation);
  const notesText =
    typeof input.notesText === "string" && input.notesText.trim()
      ? input.notesText.trim().slice(0, 300)
      : null;

  return prisma.reservationPolicy.upsert({
    where: { organizationId },
    create: {
      organizationId,
      enabled,
      minNoticeMinutes,
      maxAdvanceDays,
      maxGuests,
      maxReservationsPerDay,
      durationMinutes,
      slotMinutes,
      requireConfirmation,
      notesText,
    },
    update: {
      enabled,
      minNoticeMinutes,
      maxAdvanceDays,
      maxGuests,
      maxReservationsPerDay,
      durationMinutes,
      slotMinutes,
      requireConfirmation,
      notesText,
    },
  });
}

/** ¿El día "YYYY-MM-DD" está dentro de la ventana de anticipación de la política? */
export function dayInPolicyWindow(policy: ReservationPolicy, ymd: string): boolean {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  const min = new Date(day);
  const max = new Date(day);
  max.setDate(max.getDate() + policy.maxAdvanceDays);
  const target = new Date(`${ymd}T00:00:00`);
  return target >= min && target <= max;
}

/**
 * Horario de la sucursal → franjas de reservación del día "YYYY-MM-DD"
 * (slots de `policy.slotMinutes` dentro de los tramos abiertos). Devuelve
 * strings "HH:MM" locales. Si la sucursal no tiene horario configurado, se
 * asume abierto 09:00–22:00 (same que el fallback del seeder).
 */
export function slotsForDay(
  policy: ReservationPolicy,
  schedule: DaySchedule[] | null,
  ymd: string
): string[] {
  const day = new Date(`${ymd}T00:00:00`);
  const dow = day.getDay();
  const today = dayBounds(new Date().toISOString().slice(0, 10)).from;
  const isToday = day.getTime() === today.getTime();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const noticeMin = isToday ? policy.minNoticeMinutes : 0;

  const daySchedule = schedule?.find((s) => s.day === dow);
  const slots = daySchedule?.enabled ? daySchedule.slots : [];
  const useSlots = slots.length > 0 ? slots : [{ open: "09:00", close: "22:00" }];

  const out: string[] = [];
  for (const slot of useSlots) {
    const start = hmToMinutes(slot.open);
    const end = hmToMinutes(slot.close);
    for (let m = start; m + policy.durationMinutes <= end + policy.durationMinutes; m += policy.slotMinutes) {
      // El slot debe dejar caber la duración completa dentro del tramo y
      // respetar la anticipación mínima (solo aplica hoy).
      if (m + policy.durationMinutes > end) break;
      if (isToday && m < nowMin + noticeMin) continue;
      out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
    }
  }
  return out;
}

/** Carga el horario semanal (JSON) de la sucursal con el parser compartido. */
export async function locationSchedule(locationId: string | null): Promise<DaySchedule[] | null> {
  if (!locationId) return null;
  const loc = await prisma.location.findUnique({
    where: { id: locationId },
    select: { openingScheduleJson: true },
  });
  return loc?.openingScheduleJson ? parseSchedule(loc.openingScheduleJson) : null;
}

/**
 * Valida una reservación contra las políticas de la organización.
 * `startsAt` (Date), comensales y día objetivo deben cumplir anticipación,
 * ventana, comensales máximos y (opcional) tope diario por cliente.
 */
export async function validatePolicyForCreate(opts: {
  organizationId: string;
  customerId: string | null;
  startsAt: Date;
  guests: number;
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const policy = await getReservationPolicy(opts.organizationId);
  if (!policy.enabled) return { ok: true };

  const now = Date.now();
  if (opts.startsAt.getTime() < now) {
    return { ok: false, error: "No puedes reservar en una fecha pasada", status: 400 };
  }
  const minStart = now + policy.minNoticeMinutes * 60 * 1000;
  if (opts.startsAt.getTime() < minStart) {
    const h = Math.floor(policy.minNoticeMinutes / 60);
    const m = policy.minNoticeMinutes % 60;
    return {
      ok: false,
      error: `Reserva con ${h > 0 ? `${h} h` : ""}${h > 0 && m > 0 ? " " : ""}${m > 0 ? `${m} min` : ""} de anticipación`,
      status: 400,
    };
  }
  const maxEnd = new Date();
  maxEnd.setHours(0, 0, 0, 0);
  maxEnd.setDate(maxEnd.getDate() + policy.maxAdvanceDays);
  maxEnd.setHours(23, 59, 59, 999);
  if (opts.startsAt.getTime() > maxEnd.getTime()) {
    return {
      ok: false,
      error: `Solo se puede reservar con ${policy.maxAdvanceDays} días de anticipación`,
      status: 400,
    };
  }
  if (opts.guests > policy.maxGuests) {
    return {
      ok: false,
      error: `Máximo ${policy.maxGuests} comensales por reservación`,
      status: 400,
    };
  }

  // Tope diario por cliente (solo aplica a cuentas con customerId).
  if (opts.customerId && policy.maxReservationsPerDay != null) {
    const { from, to } = dayBounds(
      `${opts.startsAt.getFullYear()}-${String(opts.startsAt.getMonth() + 1).padStart(2, "0")}-${String(
        opts.startsAt.getDate()
      ).padStart(2, "0")}`
    );
    const count = await prisma.tableReservation.count({
      where: {
        organizationId: opts.organizationId,
        customerId: opts.customerId,
        startsAt: { gte: from, lt: to },
        status: { in: ["pending", "confirmed"] },
      },
    });
    if (count >= policy.maxReservationsPerDay) {
      return {
        ok: false,
        error: `Ya tienes ${policy.maxReservationsPerDay} reservación(es) ese día`,
        status: 400,
      };
    }
  }

  return { ok: true };
}
