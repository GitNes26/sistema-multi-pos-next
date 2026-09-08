import { randomInt } from "crypto";
import { prisma } from "@/lib/db";
import { normalizePhoneToE164 } from "@/lib/notifications/messaging";

// Verificación del invitado (sin cuenta): la reservación creada en /reservar
// guarda un código de corto plazo que el invitado usa —junto a su teléfono—
// para confirmar o cancelar desde /reservar/verificar. Sin cuentas, sin
// sesiones: teléfono + código vencido no vale.

export const GUEST_CODE_TTL_MIN = 15;
export const GUEST_CODE_LENGTH = 6;

/** Código de 6 dígitos con aleatoriedad criptográfica (sin sesgo). */
export function generateVerifyCode(): string {
  return randomInt(0, 10 ** GUEST_CODE_LENGTH).toString().padStart(GUEST_CODE_LENGTH, "0");
}

export function verifyCodeExpiry(): Date {
  return new Date(Date.now() + GUEST_CODE_TTL_MIN * 60_000);
}

/** Teléfonos candidatos para buscar la reservación (normalizado + tal cual). */
export function phoneCandidates(raw: string): string[] {
  const rawTrimmed = String(raw ?? "").trim();
  const normalized = normalizePhoneToE164(rawTrimmed);
  return Array.from(new Set([normalized, rawTrimmed].filter((p): p is string => Boolean(p))));
}

/** Estatus gestionables por el invitado. */
export const GUEST_ACTIVE_STATUSES = ["pending", "confirmed"] as const;

// ── Rate limiting en memoria (por instancia; suficiente para un nodo) ───────
const buckets = new Map<string, number[]>();

/** true si el evento cabe en `max` por `windowMs`; false si excede. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

/**
 * Emite un código nuevo para todas las reservaciones activas del teléfono
 * (una sola verificación sirve para todas). Devuelve null si no hay ninguna.
 */
export async function issueGuestVerifyCode(
  rawPhone: string,
  organizationId?: string
): Promise<{ code: string; expiresAt: Date; count: number } | null> {
  const phones = phoneCandidates(rawPhone);
  if (phones.length === 0) return null;
  const code = generateVerifyCode();
  const expiresAt = verifyCodeExpiry();
  const res = await prisma.tableReservation.updateMany({
    where: {
      phone: { in: phones },
      customerId: null, // solo reservaciones sin cuenta
      status: { in: [...GUEST_ACTIVE_STATUSES] },
      endsAt: { gte: new Date() },
      ...(organizationId ? { organizationId } : {}),
    },
    data: { verifyCode: code, verifyCodeExpiresAt: expiresAt },
  });
  if (res.count === 0) return null;
  return { code, expiresAt, count: res.count };
}
