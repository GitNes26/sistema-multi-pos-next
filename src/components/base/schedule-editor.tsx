"use client";

import { Switch } from "@/components/ui/switch";
import { emptySchedule, DAYS_LABELS, type DaySchedule } from "@/lib/schedule";

export { emptySchedule, type DaySchedule } from "@/lib/schedule";
export { formatSchedule, parseSchedule, DAYS_LABELS } from "@/lib/schedule";

interface ScheduleEditorProps {
  schedule: DaySchedule[];
  onChange: (s: DaySchedule[]) => void;
  disabled?: boolean;
}

export function ScheduleEditor({ schedule, onChange, disabled }: ScheduleEditorProps) {
  const update = (idx: number, patch: Partial<DaySchedule>) => {
    const next = schedule.map((d, i) => (i === idx ? { ...d, ...patch } : d));
    onChange(next);
  };

  return (
    <div className="space-y-1.5">
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
          <input
            type="time"
            value={s.open}
            onChange={(e) => update(i, { open: e.target.value })}
            disabled={!s.enabled || disabled}
            className="h-8 w-24 rounded-md border bg-transparent px-2 text-sm disabled:opacity-40"
          />
          <span className="text-xs text-muted-foreground">a</span>
          <input
            type="time"
            value={s.close}
            onChange={(e) => update(i, { close: e.target.value })}
            disabled={!s.enabled || disabled}
            className="h-8 w-24 rounded-md border bg-transparent px-2 text-sm disabled:opacity-40"
          />
        </div>
      ))}
    </div>
  );
}
