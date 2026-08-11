"use client"

import * as React from "react"
import { Clock, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { InfoTooltip } from "@/components/base/info-tooltip"

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)

export interface TimePickerProps {
  value?: string | null
  onChange?: (time: string | null) => void
  label?: string
  helper?: React.ReactNode
  disabled?: boolean
  clearable?: boolean
  error?: string
  className?: string
}

export function TimePicker({
  value,
  onChange,
  label,
  helper,
  disabled,
  clearable = true,
  error,
  className,
}: TimePickerProps) {
  const parts = React.useMemo(() => parseTime(value), [value])

  const emit = (
    h: number | null,
    m: number | null,
    period: "AM" | "PM" | null
  ) => {
    const ch = h ?? parts.h
    const cm = m ?? parts.m
    const cp = period ?? parts.period
    if (ch === null || cm === null || cp === null) {
      onChange?.(null)
      return
    }
    let h24 = ch % 12
    if (cp === "PM") h24 += 12
    onChange?.(`${String(h24).padStart(2, "0")}:${String(cm).padStart(2, "0")}`)
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center gap-1.5">
          <Label className="leading-none">{label}</Label>
          {helper && <InfoTooltip text={helper} />}
        </div>
      )}

      <div
        className={cn(
          "flex h-8 w-full items-center gap-1 rounded-md border border-input px-1.5",
          error && "border-destructive ring-3 ring-destructive/20"
        )}
      >
        <Clock className="size-4 shrink-0 text-muted-foreground" />
        <Select
          disabled={disabled}
          value={value ? String(parts.h) : undefined}
          onValueChange={(v) => emit(Number(v), null, null)}
        >
          <SelectTrigger
            data-slot="time-picker-part"
            className="h-6 w-14 border-0 bg-transparent px-1 text-center shadow-none focus-visible:ring-0"
            aria-label="Hora"
          >
            <SelectValue placeholder="Hora" />
          </SelectTrigger>
          <SelectContent>
            {HOURS.map((h) => (
              <SelectItem key={h} value={String(h)}>
                {String(h).padStart(2, "0")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">:</span>
        <Select
          disabled={disabled}
          value={value ? String(parts.m) : undefined}
          onValueChange={(v) => emit(null, Number(v), null)}
        >
          <SelectTrigger
            data-slot="time-picker-part"
            className="h-6 w-14 border-0 bg-transparent px-1 text-center shadow-none focus-visible:ring-0"
            aria-label="Minuto"
          >
            <SelectValue placeholder="Min" />
          </SelectTrigger>
          <SelectContent className="max-h-56">
            {MINUTES.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {String(m).padStart(2, "0")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          disabled={disabled}
          value={value ? parts.period : undefined}
          onValueChange={(v) => emit(null, null, v as "AM" | "PM")}
        >
          <SelectTrigger
            data-slot="time-picker-part"
            className="h-6 w-16 border-0 bg-transparent px-1 text-center shadow-none focus-visible:ring-0"
            aria-label="Periodo"
          >
            <SelectValue placeholder="AM/PM" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
        {clearable && value && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Limpiar hora"
            className="ml-auto"
            onClick={() => onChange?.(null)}
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>

      {error && <p className="text-xs leading-relaxed text-destructive">{error}</p>}
    </div>
  )
}

export function parseTime(
  value?: string | null
): { h: number; m: number; period: "AM" | "PM" } {
  const d = value ? toDate(value) : null
  if (!d) return { h: 12, m: 0, period: "AM" }
  const h = d.getHours()
  const m = d.getMinutes()
  return {
    h: ((h + 11) % 12) + 1,
    m,
    period: h >= 12 ? "PM" : "AM",
  }
}

function toDate(value: string): Date | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const d = new Date()
  d.setHours(Number(match[1]), Number(match[2]), 0, 0)
  return d
}