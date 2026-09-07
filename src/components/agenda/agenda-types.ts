// Tipos de la agenda compartidos entre los componentes cliente (sin prisma).
export type CitaStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";

export interface AgendaCita {
  id: string;
  status: CitaStatus;
  startsAt: string;
  endsAt: string;
  durationMin: number;
  notes: string | null;
  saleId: string | null;
  customer: { id: string; fullName: string; phone: string | null } | null;
  employee: { id: string; fullName: string };
  service: { variantId: string; name: string; price: number };
}

export interface StaffService {
  variantId: string;
  productId: string;
  name: string;
  price: number;
  durationMin: number;
  isActive: boolean;
}

export interface AgendaStaff {
  id: string;
  fullName: string;
  position: string | null;
  services: StaffService[];
}

export interface BookableService {
  variantId: string;
  productId: string;
  name: string;
  price: number;
}

export interface AgendaData {
  appointments: AgendaCita[];
  staff: AgendaStaff[];
  services: BookableService[];
}

export const STATUS_META: Record<
  CitaStatus,
  { label: string; dot: string; chip: string; block: string }
> = {
  pending: {
    label: "Pendiente",
    dot: "bg-amber-500",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
    block: "border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100",
  },
  confirmed: {
    label: "Confirmada",
    dot: "bg-sky-500",
    chip: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400",
    block: "border-sky-300 bg-sky-50 text-sky-900 hover:border-sky-400 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-100",
  },
  completed: {
    label: "Cobrada",
    dot: "bg-emerald-500",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
    block: "border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-emerald-400 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-100",
  },
  cancelled: {
    label: "Cancelada",
    dot: "bg-slate-400",
    chip: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400",
    block: "border-slate-300 bg-slate-100 text-slate-500 line-through hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400",
  },
  no_show: {
    label: "No asistió",
    dot: "bg-rose-500",
    chip: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400",
    block: "border-rose-300 bg-rose-50 text-rose-800 hover:border-rose-400 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-100",
  },
};

/** Horario base de la agenda: 09:00–19:00 en bloques de 30 min. */
export const DAY_START_HOUR = 9;
export const DAY_END_HOUR = 19;
export const SLOT_MIN = 30;
export const ROW_HEIGHT = 44;

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function slotIndex(minutes: number): number {
  return Math.floor((minutes - DAY_START_HOUR * 60) / SLOT_MIN);
}

export function fmtTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

export function fmtDay(d: Date): string {
  return d.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function fmtMoney(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(n);
}

export function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** Convierte "AAAA-MM-DD" a medianoche LOCAL (new Date("YYYY-MM-DD") es UTC). */
export function fromYMD(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y || 0, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

export function fromDateInput(day: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

export function dayRange(day: Date): { from: Date; to: Date } {
  const from = new Date(day);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from, to };
}

/** Snap un instante al bloque de 30 min más cercano dentro del horario. */
export function snapToSlot(d: Date): Date {
  const out = new Date(d);
  const mins = out.getMinutes();
  if (mins % SLOT_MIN !== 0) {
    out.setMinutes(mins < SLOT_MIN / 2 ? 0 : SLOT_MIN, 0, 0);
  }
  return out;
}