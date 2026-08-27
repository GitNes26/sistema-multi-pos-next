"use client";

import { Switch } from "@/components/ui/switch";
import { TimePicker } from "@/components/base/time-picker";
import { emptySchedule, DAYS_LABELS, type DaySchedule } from "@/lib/schedule";

export { emptySchedule, type DaySchedule } from "@/lib/schedule";
export { formatSchedule, parseSchedule, DAYS_LABELS } from "@/lib/schedule";

interface ScheduleEditorProps {
  schedule: DaySchedule[];
  onChange: (s: DaySchedule[]) => void;
  disabled?: boolean;
}

function buildLegend(schedule: DaySchedule[]): string {
  const enabled = schedule.filter((d) => d.enabled);
  if (enabled.length === 0) return "Cerrado todos los días";

  // Group consecutive days with same hours
  const groups: { days: number[]; open: string; close: string }[] = [];
  for (const d of schedule) {
    if (!d.enabled) continue;
    const last = groups[groups.length - 1];
    if (last && last.open === d.open && last.close === d.close) {
      // Check if consecutive (or Sunday after Saturday)
      const prevDay = last.days[last.days.length - 1];
      if (d.day === prevDay + 1 || (prevDay === 6 && d.day === 0)) {
        last.days.push(d.day);
        continue;
      }
    }
    groups.push({ days: [d.day], open: d.open, close: d.close });
  }

  const fmt = (h: string) => {
    const [hh, mm] = h.split(":").map(Number);
    const period = hh >= 12 ? "PM" : "AM";
    const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
    return mm === 0 ? `${h12} ${period}` : `${h12}:${String(mm).padStart(2, "0")} ${period}`;
  };

  const parts = groups.map((g) => {
    const dayNames = g.days.map((d) => DAYS_LABELS[d]);
    let range: string;
    if (dayNames.length === 1) {
      range = dayNames[0];
    } else if (dayNames.length === 2) {
      range = `${dayNames[0]} y ${dayNames[1]}`;
    } else {
      range = `${dayNames[0]}–${dayNames[dayNames.length - 1]}`;
    }
    return `${range} ${fmt(g.open)} – ${fmt(g.close)}`;
  });

  return parts.join(", ");
}

export function ScheduleEditor({ schedule, onChange, disabled }: ScheduleEditorProps) {
  const update = (idx: number, patch: Partial<DaySchedule>) => {
    const next = schedule.map((d, i) => (i === idx ? { ...d, ...patch } : d));
    onChange(next);
  };

  const legend = buildLegend(schedule);

  return (
    <div className="space-y-3">
      {/* Leyenda en tiempo real */}
      <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Horario: </span>
        {legend}
      </div>

      {/* Editor por día */}
      {schedule.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-10 text-xs font-medium text-muted-foreground">
            {DAYS_LABELS[s.day]}
          </span>
          <Switch
            checked={s.enabled}
            onCheckedChange={(v) => update(i, { enabled: v })}
            disabled={disabled}
          />
          <TimePicker
            value={s.open}
            onChange={(v) => update(i, { open: v ?? "09:00" })}
            disabled={!s.enabled || disabled}
            clearable={false}
            className="w-28"
          />
          <span className="text-xs text-muted-foreground">a</span>
          <TimePicker
            value={s.close}
            onChange={(v) => update(i, { close: v ?? "18:00" })}
            disabled={!s.enabled || disabled}
            clearable={false}
            className="w-28"
          />
        </div>
      ))}
    </div>
  );
}
