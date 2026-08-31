"use client"

import { CalendarDays, Clock, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { InfoTooltip } from "@/components/base/info-tooltip"
import { DatePicker } from "@/components/base/date-picker"
import { TimePicker } from "@/components/base/time-picker"

export interface DateTimePickerProps {
  value?: Date | null
  onChange?: (date: Date | null) => void
  onClear?: () => void
  label?: string
  helper?: React.ReactNode
  placeholder?: string
  disabled?: boolean
  disabledBefore?: Date
  disabledAfter?: Date
  clearable?: boolean
  error?: string
  className?: string
}

/** Combina DatePicker + TimePicker en un solo control vertical. */
export function DateTimePicker({
  value,
  onChange,
  onClear,
  label,
  helper,
  placeholder,
  disabled,
  disabledBefore,
  disabledAfter,
  clearable = true,
  error,
  className,
}: DateTimePickerProps) {
  const timeStr = value
    ? `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`
    : null

  const handleDateChange = (d: Date | null) => {
    if (!d) {
      onChange?.(null)
      return
    }
    const next = new Date(d)
    if (value) {
      next.setHours(value.getHours(), value.getMinutes(), 0, 0)
    }
    onChange?.(next)
  }

  const handleTimeChange = (t: string | null) => {
    if (!t) {
      onChange?.(null)
      return
    }
    const [h, m] = t.split(":").map(Number)
    const next = value ? new Date(value) : new Date()
    next.setHours(h, m, 0, 0)
    onChange?.(next)
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center gap-1.5">
          <Label>{label}</Label>
          {helper && <InfoTooltip text={helper} />}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <DatePicker
          value={value}
          onChange={handleDateChange}
          onClear={onClear}
          disabled={disabled}
          disabledBefore={disabledBefore}
          disabledAfter={disabledAfter}
          clearable={clearable}
          placeholder={placeholder}
        />
        <TimePicker
          value={timeStr}
          onChange={handleTimeChange}
          disabled={disabled}
          clearable={clearable}
          error={error}
        />
      </div>
      {error && <p className="text-xs leading-relaxed text-destructive">{error}</p>}
    </div>
  )
}
