// Tipos de reservaciones compartidos entre los componentes cliente (sin prisma).
export type ReservationStatus = "pending" | "confirmed" | "completed" | "cancelled";

export interface ReservationItemView {
  variantId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ReservationView {
  id: string;
  status: ReservationStatus;
  startsAt: string;
  endsAt: string;
  notes: string | null;
  saleId: string | null;
  customer: { id: string; fullName: string; phone: string | null } | null;
  items: ReservationItemView[];
  total: number;
}

export interface RentUnit {
  variantId: string;
  productId: string;
  name: string;
  price: number;
  totalUnits: number;
}

export interface ReservationsData {
  reservations: ReservationView[];
  units: RentUnit[];
}

/** Estatus que apartan unidades (disponibilidad). */
export const ACTIVE: ReservationStatus[] = ["pending", "confirmed", "completed"];

export const STATUS_META: Record<
  ReservationStatus,
  { label: string; dot: string; chip: string; row: string }
> = {
  pending: {
    label: "Pendiente",
    dot: "bg-amber-500",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
    row: "border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10",
  },
  confirmed: {
    label: "Confirmada",
    dot: "bg-sky-500",
    chip: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400",
    row: "border-sky-300 bg-sky-50 dark:border-sky-500/30 dark:bg-sky-500/10",
  },
  completed: {
    label: "Cobrada",
    dot: "bg-emerald-500",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
    row: "border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10",
  },
  cancelled: {
    label: "Cancelada",
    dot: "bg-slate-400",
    chip: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400",
    row: "border-slate-300 bg-slate-100 opacity-70 dark:border-slate-700 dark:bg-slate-900",
  },
};

export function fmtDay(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function fmtDayShort(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export function fmtMoney(n: number): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n);
}

export function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** "AAAA-MM-DD" → medianoche LOCAL (new Date("YYYY-MM-DD") es UTC). */
export function fromYMD(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y || 0, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

export function dayRange(day: Date): { from: Date; to: Date } {
  const from = new Date(day);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from, to };
}

/** ¿El día cae dentro del período [startsAt, endsAt)? */
export function dayInPeriod(day: Date, startsAt: string, endsAt: string): boolean {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  return d >= start && d < end;
}

export function rangeLabel(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const endExclusive = new Date(e);
  endExclusive.setDate(endExclusive.getDate() - 1);
  const same = s.toDateString() === endExclusive.toDateString();
  if (same) return `El ${fmtDayShort(s)} (1 día)`;
  return `${fmtDayShort(s)} → ${fmtDayShort(endExclusive)} (${Math.round(
    (endExclusive.getTime() - s.getTime()) / 86400000
  ) + 1} días)`;
}

export function monthTitle(d: Date): string {
  return d.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}