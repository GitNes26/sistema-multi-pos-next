"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { DatePicker } from "@/components/base/date-picker"
import { TimePicker } from "@/components/base/time-picker"
import { dateToTime } from "@/lib/dates"

export interface DateTimePickerProps {
  value?: Date | null
  onChange?: (date: Date | null) => void
  dateProps?: Partial<React.ComponentProps<typeof DatePicker>>
  timeProps?: Partial<React.ComponentProps<typeof TimePicker>>
  className?: string
  disabled?: boolean
  label?: string
  helper?: React.ReactNode
}

export function DateTimePicker({
  value,
  onChange,
  dateProps,
  timeProps,
  className,
  disabled,
  label,
  helper,
}: DateTimePickerProps) {
  const time = value ? dateToTime(value) : null

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <p className="flex items-center gap-1.5 text-sm font-medium leading-none">
          {label}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <DatePicker
          value={value}
          disabled={disabled}
          onChange={(d) => {
            if (!d) {
              onChange?.(null)
              return
            }
            const base = value ? new Date(value) : new Date()
            base.setFullYear(d.getFullYear(), d.getMonth(), d.getDate())
            onChange?.(base)
          }}
          {...dateProps}
        />
        <TimePicker
          value={time}
          disabled={disabled}
          onChange={(t) => {
            if (!t) {
              const base = value ? new Date(value) : new Date()
              base.setHours(0, 0, 0, 0)
              onChange?.(value ? base : null)
              return
            }
            const base = value ? new Date(value) : new Date()
            const [h, m] = t.split(":").map(Number)
            base.setHours(h, m, 0, 0)
            onChange?.(base)
          }}
          {...timeProps}
        />
      </div>
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  )
}