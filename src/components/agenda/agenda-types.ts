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
    dot: "bg-warning",
    chip: "bg-warning/15 text-warning-ink",
    block: "border-warning/45 bg-warning/12 text-foreground hover:border-warning",
  },
  confirmed: {
    label: "Confirmada",
    dot: "bg-info",
    chip: "bg-info/15 text-info-ink",
    block: "border-info/45 bg-info/12 text-foreground hover:border-info",
  },
  completed: {
    label: "Cobrada",
    dot: "bg-success",
    chip: "bg-success/15 text-success-ink",
    block: "border-success/45 bg-success/12 text-foreground hover:border-success",
  },
  cancelled: {
    label: "Cancelada",
    dot: "bg-muted-foreground",
    chip: "bg-muted text-muted-foreground",
    block: "border-border bg-muted text-muted-foreground line-through hover:border-foreground/25",
  },
  no_show: {
    label: "No asistió",
    dot: "bg-destructive",
    chip: "bg-destructive/15 text-destructive",
    block: "border-destructive/45 bg-destructive/12 text-foreground hover:border-destructive",
  },
};

/** Horario base de la agenda: 09:00–19:00 en bloques de 30 min. */
export const DAY_START_HOUR = 9;
export const DAY_END_HOUR = 19;
export const SLOT_MIN = 30;
export const ROW_HEIGHT = 48;

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