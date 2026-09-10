"use client"

import { Copy, Plus, Trash2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { TimePicker } from "@/components/base/time-picker"
import {
  DAYS_LABELS,
  type DaySchedule,
  type DayScheduleSlot,
} from "@/lib/schedule"

export {
  emptySchedule,
  type DaySchedule,
  type DayScheduleSlot,
} from "@/lib/schedule"
export { formatSchedule, parseSchedule, DAYS_LABELS } from "@/lib/schedule"

interface ScheduleEditorProps {
  schedule: DaySchedule[]
  onChange: (s: DaySchedule[]) => void
  disabled?: boolean
}

export function buildLegend(schedule: DaySchedule[]): string {
  const enabled = schedule.filter((d) => d.enabled)
  if (enabled.length === 0) return "Cerrado todos los días"

  // Group consecutive days with same slots
  const groups: { days: number[]; slots: DayScheduleSlot[] }[] = []
  for (const d of schedule) {
    if (!d.enabled) continue
    const slotsKey = JSON.stringify(d.slots)
    const last = groups[groups.length - 1]
    if (last && JSON.stringify(last.slots) === slotsKey) {
      const prevDay = last.days[last.days.length - 1]
      if (d.day === prevDay + 1 || (prevDay === 6 && d.day === 0)) {
        last.days.push(d.day)
        continue
      }
    }
    groups.push({ days: [d.day], slots: d.slots })
  }

  const fmt = (h: string) => {
    const [hh, mm] = h.split(":").map(Number)
    const period = hh >= 12 ? "PM" : "AM"
    const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh
    return mm === 0
      ? `${h12} ${period}`
      : `${h12}:${String(mm).padStart(2, "0")} ${period}`
  }

  const formatSlots = (slots: DayScheduleSlot[]) =>
    slots.map((s) => `${fmt(s.open)} – ${fmt(s.close)}`).join(" / ")

  const parts = groups.map((g) => {
    const dayNames = g.days.map((d) => DAYS_LABELS[d])
    let range: string
    if (dayNames.length === 1) {
      range = dayNames[0]
    } else if (dayNames.length === 2) {
      range = `${dayNames[0]} y ${dayNames[1]}`
    } else {
      range = `${dayNames[0]}–${dayNames[dayNames.length - 1]}`
    }
    return `${range} ${formatSlots(g.slots)}`
  })

  return parts.join(", ")
}

export function ScheduleEditor({
  schedule,
  onChange,
  disabled,
}: ScheduleEditorProps) {
  const updateDay = (idx: number, patch: Partial<DaySchedule>) => {
    const next = schedule.map((d, i) => (i === idx ? { ...d, ...patch } : d))
    onChange(next)
  }

  const updateSlot = (
    dayIdx: number,
    slotIdx: number,
    patch: Partial<DayScheduleSlot>
  ) => {
    const next = schedule.map((d, i) => {
      if (i !== dayIdx) return d
      const slots = d.slots.map((s, j) =>
        j === slotIdx ? { ...s, ...patch } : s
      )
      return { ...d, slots }
    })
    onChange(next)
  }

  const addSlot = (dayIdx: number) => {
    const next = schedule.map((d, i) => {
      if (i !== dayIdx) return d
      return { ...d, slots: [...d.slots, { open: "14:00", close: "18:00" }] }
    })
    onChange(next)
  }

  const removeSlot = (dayIdx: number, slotIdx: number) => {
    const next = schedule.map((d, i) => {
      if (i !== dayIdx) return d
      if (d.slots.length <= 1) return d
      return { ...d, slots: d.slots.filter((_, j) => j !== slotIdx) }
    })
    onChange(next)
  }

  const legend = buildLegend(schedule)

  // Replicar la configuración del lunes (o del primer día con horario) en el resto de la semana.
  const replicateMonday = () => {
    const monday = schedule.find((d) => d.day === 1)
    const source = monday && monday.slots.length > 0 ? monday : schedule.find((d) => d.enabled && d.slots.length > 0)
    if (!source) return
    onChange(
      schedule.map((d) =>
        d.day === source.day
          ? d
          : { day: d.day, enabled: true, slots: source.slots.map((s) => ({ ...s })) }
      )
    )
  }

  const hasSource = schedule.some((d) => d.enabled && d.slots.length > 0)

  return (
    <div className="space-y-3">
      {/* Leyenda en tiempo real + replicar lunes */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Horario: </span>
          {legend}
          {!hasSource && (
            <p className="mt-0.5 text-xs text-muted-foreground/80">
              Tip: configura el Lunes y replica en el resto de la semana con un toque.
            </p>
          )}
        </div>
        {hasSource && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 gap-1.5 whitespace-nowrap"
            onClick={replicateMonday}
            disabled={disabled}
            title="Copia el horario del lunes a los demás días"
          >
            <Copy className="size-3.5" />
            Replicar Lun
          </Button>
        )}
      </div>
      {schedule.map((s, dayIdx) => (
        <div key={dayIdx} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-10 text-xs font-medium text-muted-foreground">
              {DAYS_LABELS[s.day]}
            </span>
            <Switch
              className="hover:cursor-pointer hover:shadow-xl"
              checked={s.enabled}
              onCheckedChange={(v) => updateDay(dayIdx, { enabled: v })}
              disabled={disabled}
            />
          </div>
          {s.enabled && (
            <div className="ml-12 space-y-1.5">
              {s.slots.map((slot, slotIdx) => (
                <div key={slotIdx} className="flex items-center gap-2">
                  <TimePicker
                    value={slot.open}
                    onChange={(v) =>
                      updateSlot(dayIdx, slotIdx, { open: v ?? "09:00" })
                    }
                    disabled={disabled}
                    clearable={false}
                    size="sm"
                  />
                  <span className="text-xs text-muted-foreground">a</span>
                  <TimePicker
                    value={slot.close}
                    onChange={(v) =>
                      updateSlot(dayIdx, slotIdx, { close: v ?? "18:00" })
                    }
                    disabled={disabled}
                    clearable={false}
                    size="sm"
                  />
                  {s.slots.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeSlot(dayIdx, slotIdx)}
                      disabled={disabled}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => addSlot(dayIdx)}
                disabled={disabled}
              >
                <Plus className="size-3" />
                Agregar horario
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
