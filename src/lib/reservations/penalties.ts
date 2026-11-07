import { round2 } from "@/lib/pos/money";

// Cálculo puro de cargos y liquidación del depósito al devolver una renta.

const DAY_MS = 86_400_000;

export interface PenaltyPolicy {
  lateFeePerDay: number;
  graceMinutes: number;
}

/** Días (o fracción) de retraso pasada la gracia; 0 si se devolvió a tiempo. */
export function lateDays(endsAt: Date, returnedAt: Date, graceMinutes: number): number {
  const overtime = returnedAt.getTime() - endsAt.getTime() - Math.max(0, graceMinutes) * 60_000;
  return overtime <= 0 ? 0 : Math.ceil(overtime / DAY_MS);
}

export function computeLateFee(endsAt: Date, returnedAt: Date, policy: PenaltyPolicy): number {
  return round2(lateDays(endsAt, returnedAt, policy.graceMinutes) * Math.max(0, policy.lateFeePerDay));
}

/** Los cargos se cubren con el depósito; lo que sobra se regresa y lo que falta queda como saldo. */
export function settleDeposit(deposit: number, charges: number): { retained: number; refund: number; balanceDue: number } {
  const d = Math.max(0, deposit);
  const c = Math.max(0, charges);
  const retained = Math.min(d, c);
  return { retained: round2(retained), refund: round2(d - retained), balanceDue: round2(c - retained) };
}
