export interface DaySchedule {
  day: number;
  enabled: boolean;
  open: string;
  close: string;
}

export const DAYS_LABELS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

export function emptySchedule(): DaySchedule[] {
  return Array.from({ length: 7 }, (_, i) => ({
    day: i,
    enabled: i >= 1 && i <= 5,
    open: "09:00",
    close: "18:00",
  }));
}

export function parseSchedule(raw: unknown): DaySchedule[] {
  if (Array.isArray(raw)) return raw as DaySchedule[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as DaySchedule[];
    } catch {}
  }
  return emptySchedule();
}

export function formatSchedule(schedule: DaySchedule[]): string {
  const enabled = schedule.filter((d) => d.enabled);
  if (enabled.length === 0) return "Cerrado";
  if (enabled.length === 7) return `${enabled[0].open} – ${enabled[0].close}`;
  const names = enabled.map((d) => DAYS_LABELS[d.day]).join(", ");
  return `${names} ${enabled[0].open} – ${enabled[0].close}`;
}

export function isScheduleOpenNow(schedule: DaySchedule[] | null, timezone = "America/Mexico_City"): { open: boolean; message: string } {
  if (!schedule || schedule.length === 0) return { open: false, message: "Sin horario" };
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  });
  const parts = formatter.formatToParts(now);
  const dayStr = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const currentMinutes = hour * 60 + minute;
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const today = dayMap[dayStr] ?? 0;
  const todaySchedule = schedule.find((s) => s.day === today);
  if (!todaySchedule || !todaySchedule.enabled) return { open: false, message: "Cerrado hoy" };
  const [openH, openM] = todaySchedule.open.split(":").map(Number);
  const [closeH, closeM] = todaySchedule.close.split(":").map(Number);
  const isOpen = currentMinutes >= openH * 60 + openM && currentMinutes < closeH * 60 + closeM;
  return { open: isOpen, message: isOpen ? `Abierto hasta ${todaySchedule.close}` : `Abre a las ${todaySchedule.open}` };
}
